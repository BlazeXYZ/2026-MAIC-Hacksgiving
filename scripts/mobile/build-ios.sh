#!/usr/bin/env bash
# Build one unsigned arm64 .ipa. Requires macOS and Xcode.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLIENT="$ROOT/src/client"
OUT="$ROOT/dist/mobile"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The iOS package has to be built on macOS with Xcode. This runner is $(uname -s)." >&2
  exit 1
fi
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild is not installed." >&2
  exit 1
fi

mkdir -p "$OUT"
cd "$CLIENT"
npm ci
npm run build
if [[ ! -d ios/App ]]; then
  npx cap add ios
fi
npx cap sync ios
python3 "$ROOT/scripts/mobile/apply-native.py"

cd "$CLIENT/ios/App"
pod install

DERIVED="$OUT/ios-derived"
rm -rf "$DERIVED"
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphoneos \
  -destination "generic/platform=iOS" \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  DEVELOPMENT_TEAM="" \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=NO \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build

APP="$(find "$DERIVED/Build/Products" -type d -name '*.app' -path '*iphoneos*' | head -1)"
if [[ -z "$APP" ]]; then
  echo "xcodebuild finished without an .app." >&2
  exit 1
fi

STAGE="$OUT/ipa-stage"
rm -rf "$STAGE"
mkdir -p "$STAGE/Payload"
cp -R "$APP" "$STAGE/Payload/"
rm -f "$OUT/ComForceMKE-unsigned.ipa"
(cd "$STAGE" && zip -qry "$OUT/ComForceMKE-unsigned.ipa" Payload)
rm -rf "$STAGE"
echo "Wrote $OUT/ComForceMKE-unsigned.ipa"
