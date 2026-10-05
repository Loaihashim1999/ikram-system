#!/bin/sh
set -eu

apk list --installed libxml2 | grep -q '^libxml2-2.13.9-r2 '
mkdir -p /tmp/libxml-security /out/usr/lib /out/usr/share/ikram-security
cd /tmp/libxml-security
curl --fail --location --silent --show-error --output libxml2-2.13.9.tar.xz https://download.gnome.org/sources/libxml2/2.13/libxml2-2.13.9.tar.xz
echo 'a2c9ae7b770da34860050c309f903221c67830c86e4a7e760692b803df95143a  libxml2-2.13.9.tar.xz' | sha256sum -c -
curl --fail --location --silent --show-error --output CVE-2026-6732.patch https://raw.githubusercontent.com/alpinelinux/aports/3.24-stable/main/libxml2/CVE-2026-6732.patch
curl --fail --location --silent --show-error --output CVE-2026-6732-test.patch https://raw.githubusercontent.com/alpinelinux/aports/3.24-stable/main/libxml2/CVE-2026-6732-test.patch
echo 'a54eca0b69fb49c9894684069b0e68dd80f002977c59249bee6d1a168391179e9815dfbe49a9cce3de28ca4a1bdfcac8a691daa240dd70a0206d24d32f6e84cb  CVE-2026-6732.patch' | sha512sum -c -
echo '9117a6a060d9c760ae4aa88c33131b02b4677a6703fe02ea36a474035c901d5da778a4d98402a87187410e9bcfe9819d382f9df4e6fe42ff3cf33acc88ba28a9  CVE-2026-6732-test.patch' | sha512sum -c -
curl --fail --location --silent --show-error --output upstream-d1686f91.patch https://github.com/GNOME/libxml2/commit/d1686f91dbda141a752200419d35639fd6b38340.patch
echo '5e51f8dcadfe3294a15d9e8644d61e8d92bd5b9e72c10cf13ef010eccfbfa4df  upstream-d1686f91.patch' | sha256sum -c -
# The adapted patch must contain exactly the official added/removed code lines.
grep -E '^[+-][^+-]' upstream-d1686f91.patch > official-changes
grep -E '^[+-][^+-]' /security/libxml2-CVE-2026-86140.patch > backport-changes
diff -u official-changes backport-changes
tar -xf libxml2-2.13.9.tar.xz
cd libxml2-2.13.9
patch --fuzz=2 -p1 < ../CVE-2026-6732.patch
patch --fuzz=2 -p1 < ../CVE-2026-6732-test.patch
if grep -Eq 'ctxt->sax->(characters|cdataBlock)\(ctxt, cur->content, len\)' parser.c; then
    echo 'ERROR: existing Alpine SAX callback fix was not preserved' >&2
    exit 1
fi

# A meaningful negative control must reproduce the unpatched overflow.
awk '/^xmlSnprintfElements\(char/{found=1} found{print} found && /^}/{exit}' valid.c > /tmp/libxml-security/xml-snprint.inc
cc -O2 -I/usr/include/libxml2 -I/tmp/libxml-security /security/libxml2-bounds-check.c -lxml2 -o /tmp/libxml-security/bounds-before
if /tmp/libxml-security/bounds-before; then
    echo 'ERROR: security regression failed to reproduce the original issue' >&2
    exit 1
fi
patch --fuzz=0 -p1 < /security/libxml2-CVE-2026-86140.patch
awk '/^xmlSnprintfElements\(char/{found=1} found{print} found && /^}/{exit}' valid.c > /tmp/libxml-security/xml-snprint.inc
cc -O2 -I/usr/include/libxml2 -I/tmp/libxml-security /security/libxml2-bounds-check.c -lxml2 -o /tmp/libxml-security/bounds-after
/tmp/libxml-security/bounds-after

# Match Alpine's C-library configuration; Python bindings are not runtime artifacts.
./configure --prefix=/usr --sysconfdir=/etc --disable-static --enable-shared --with-legacy --with-lzma --with-zlib --without-python
make -j"$(nproc)"
# Same two exclusions used by Alpine's authoritative package recipe.
rm -f test/icu_parse_test.xml test/ebcdic_566012.xml
make runtests > /tmp/libxml-security/upstream-tests.log 2>&1
tail -n 8 /tmp/libxml-security/upstream-tests.log
make DESTDIR=/tmp/libxml-security/install install > /tmp/libxml-security/install.log
library=/tmp/libxml-security/install/usr/lib/libxml2.so.2.13.9
readelf -d "$library" | grep -q 'SONAME.*\[libxml2.so.2\]'
nm -D --defined-only /usr/lib/libxml2.so.2 | awk '$2 != "A" {print $3}' | sort > /tmp/libxml-security/symbols-before
nm -D --defined-only "$library" | awk '$2 != "A" {print $3}' | sort > /tmp/libxml-security/symbols-after
diff -u /tmp/libxml-security/symbols-before /tmp/libxml-security/symbols-after
LD_PRELOAD="$library" php /security/libxml2-php-smoke.php
cp "$library" /out/usr/lib/libxml2.so.2.13.9
{
    echo 'libxml2 2.13.9; ABI libxml2.so.2; locally backported CVE-2026-86140'
    echo 'Upstream fix: GNOME/libxml2 commit d1686f91dbda141a752200419d35639fd6b38340'
    echo 'Base source SHA256: a2c9ae7b770da34860050c309f903221c67830c86e4a7e760692b803df95143a'
    echo 'Preserves Alpine 3.24 libxml2 2.13.9-r2 CVE-2026-6732 source/test patches with official SHA512 verification'
    echo 'PASS: negative unpatched control, patched buffer-canary regression, upstream runtests, unchanged exported symbols and SONAME, PHP XML ABI smoke'
    sha256sum /security/libxml2-CVE-2026-86140.patch /out/usr/lib/libxml2.so.2.13.9
} > /out/usr/share/ikram-security/libxml2-backport.txt
cp /tmp/libxml-security/upstream-tests.log /out/usr/share/ikram-security/libxml2-upstream-tests.log
cp Copyright /out/usr/share/ikram-security/libxml2-Copyright
