#!/bin/sh
# Production image content gate. Reports categories and file paths only, never matched values.
set -eu

root=/var/www/html

forbid() {
  echo "Forbidden production image content: $1" >&2
  exit 1
}

[ ! -e "$root/.env" ] || forbid "$root/.env"
[ ! -d "$root/.git" ] || forbid "$root/.git"
[ ! -d "$root/tests" ] || forbid "$root/tests"
[ ! -e "$root/database/database.sqlite" ] || forbid "$root/database/database.sqlite"
# A negated pipeline is exempt from set -e, so this check must exit explicitly.
database_file=$(find "$root" -type f \( -name "*.sqlite" -o -name "*.sqlite3" -o -name "*.db" \) -print | head -n 1)
[ -z "$database_file" ] || forbid "$database_file"

# firebase/php-jwt v7.1.0 documents usage with an example RSA key. Any change to the file is re-flagged.
reviewed_key_example="vendor/firebase/php-jwt/README.md"
reviewed_key_example_sha256="438ada1aa84a29a2b0e938f8d3fdcfa298de6587675ae0b342347a2eeb99290d"

# Sentry browser DSNs carry only the public client key and are designed to ship in frontend bundles.
sentry_public_dsn='https://[0-9a-f]{32}@o[0-9]+\.ingest(\.[a-z]+)?\.sentry\.io/[0-9]+'
credential_in_url='https?://[^/@[:space:]]{20,}@'

failed=0

flag() {
  echo "Known credential pattern ($1) in: $2" >&2
  failed=1
}

matching_files() {
  status=0
  grep -RlIE -e "$1" "$root" || status=$?
  if [ "$status" -gt 1 ]; then
    echo "Credential scan could not read every file under $root." >&2
    return 2
  fi
}

for check in \
  "AWS_ACCESS_KEY|AKIA[0-9A-Z]{16}" \
  "GITHUB_TOKEN|gh[pousr]_[A-Za-z0-9]{20,}" \
  "SLACK_TOKEN|xox[baprs]-[A-Za-z0-9-]{10,}"; do
  category=${check%%|*}
  pattern=${check#*|}
  files=$(matching_files "$pattern") || exit 1
  for file in $files; do
    flag "$category" "$file"
  done
done

files=$(matching_files '-----BEGIN [A-Z ]*PRIVATE KEY-----') || exit 1
for file in $files; do
  if [ "$file" = "$root/$reviewed_key_example" ] \
    && [ "$(sha256sum "$file" | cut -d' ' -f1)" = "$reviewed_key_example_sha256" ]; then
    echo "Reviewed dependency documentation example key: $file"
    continue
  fi
  flag PRIVATE_KEY "$file"
done

files=$(matching_files "$credential_in_url") || exit 1
for file in $files; do
  case "$file" in
    "$root"/public/assets/*.js)
      total=$(grep -oE "$credential_in_url" "$file" | wc -l)
      public_dsn=$(grep -oE "$sentry_public_dsn" "$file" | wc -l)
      if [ "$total" -eq "$public_dsn" ]; then
        echo "Sentry public browser DSN only: $file"
        continue
      fi
      ;;
  esac
  flag CREDENTIAL_IN_URL "$file"
done

if [ "$failed" -ne 0 ]; then
  echo "Known credential pattern detected in image contents." >&2
  exit 1
fi

echo "Production image contents check passed."
