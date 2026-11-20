#!/bin/sh
# Installs the pinned Supabase CLI release on a Linux x64 CI runner, checked
# against its published SHA-256, into the folder given (T-13). The deploy
# workflow's migration steps use it. A release file, not npm or a setup
# action: nothing resolves at run time and nothing writes a cache.
set -eu

VERSION=2.122.1
SHA256=3e54b98e5ead7be0a3b0753526833d4cc9a55304e4d57da0d72f1efc342738ea
DESTINATION=${1:?usage: install-supabase.sh <folder>}

archive="$DESTINATION/supabase.tar.gz"
curl --fail --silent --show-error --location --output "$archive" \
  "https://github.com/supabase/cli/releases/download/v${VERSION}/supabase_${VERSION}_linux_amd64.tar.gz"
echo "$SHA256  $archive" | sha256sum --check --strict
tar --extract --gzip --file "$archive" --directory "$DESTINATION" supabase
rm "$archive"
"$DESTINATION/supabase" --version
