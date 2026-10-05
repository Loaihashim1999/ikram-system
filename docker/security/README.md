# Bounded libxml2 security backport

The runtime remains on the reviewed `libxml2.so.2` ABI. Do not substitute libxml2 2.15 or Alpine edge packages into the existing PHP runtime.

Source: [GNOME libxml2 2.13.9 release checksum](https://download.gnome.org/sources/libxml2/2.13/libxml2-2.13.9.sha256sum). The build requires SHA256 `a2c9ae7b770da34860050c309f903221c67830c86e4a7e760692b803df95143a`.

Existing distribution fixes/configuration: [Alpine 3.24 package recipe](https://github.com/alpinelinux/aports/blob/3.24-stable/main/libxml2/APKBUILD). Both existing CVE-2026-6732 source and regression patches are retained and checked against that recipe's SHA512 values. Source updates at the same URL fail checksum verification rather than being silently trusted.

Additional fix: [official GNOME commit d1686f91dbda141a752200419d35639fd6b38340](https://github.com/GNOME/libxml2/commit/d1686f91dbda141a752200419d35639fd6b38340). The local patch adapts its two bounds-check hunks to 2.13.9 line/context differences; no exported API or structure is modified. It applies with zero fuzz.

The security stage must pass all of these before runtime replacement:

- Exact installed baseline `libxml2-2.13.9-r2`.
- Original helper fails the buffer-canary regression (negative control).
- Backported helper preserves boundaries for 525312 input cases.
- Upstream `make runtests`, retaining Alpine's two documented fixture exclusions.
- Same `libxml2.so.2` SONAME and exact exported symbol list.
- PHP DOM, schema validation, SimpleXML and XMLWriter smoke with the patched library preloaded.

Runtime also upgrades stable Alpine packages before installing application dependencies. Built proof is retained at `/usr/share/ikram-security/libxml2-backport.txt`, including source/patch/binary hashes and upstream test output. Build tools remain in a separate stage.

Package metadata still identifies Alpine's libxml2 2.13.9-r2, so a version-based scanner can continue flagging CVE-2026-86140. No scanner exclusions or VEX statements are added here. Any later narrowly scoped VEX decision must bind the final image digest and the actually copied binary hash, verify the above test/provenance artifacts, and identify the vulnerability as fixed by this backport. Unrelated vulnerabilities remain actionable. This document alone does not establish that the image or backport tests passed.
