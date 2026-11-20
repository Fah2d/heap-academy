#!/bin/sh
# Installs the pinned gitleaks release on a Linux x64 CI runner, checked
# against its published SHA-256, into the folder given (T-13). The secret scan
# of the static job and the unit tests of the secret-scan configuration both
# use it. On a working machine, install gitleaks with the package manager.
set -eu

VERSION=8.30.1
SHA256=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
DESTINATION=${1:?usage: install-gitleaks.sh <folder>}

archive="$DESTINATION/gitleaks.tar.gz"
curl --fail --silent --show-error --location --output "$archive" \
  "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz"
echo "$SHA256  $archive" | sha256sum --check --strict
tar --extract --gzip --file "$archive" --directory "$DESTINATION" gitleaks
rm "$archive"
"$DESTINATION/gitleaks" version
