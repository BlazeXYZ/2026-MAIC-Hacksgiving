#!/usr/bin/env bash
# Build one debug APK that contains only arm64-v8a.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLIENT="$ROOT/src/client"
CACHE="${COMFORCE_TOOL_CACHE:-$HOME/.cache/comforce-mobile}"
OUT="$ROOT/dist/mobile"
mkdir -p "$OUT" "$CACHE"

install_node() {
  if command -v npm >/dev/null 2>&1; then
    return
  fi
  local dest="$CACHE/node"
  if [[ ! -x "$dest/bin/npm" ]]; then
    echo "Installing Node.js 22 into $dest"
    curl -fsSL "https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz" -o "$CACHE/node.tar.xz"
    rm -rf "$dest"
    mkdir -p "$dest"
    tar -xJf "$CACHE/node.tar.xz" -C "$dest" --strip-components=1
  fi
  export PATH="$dest/bin:$PATH"
}

java_major() {
  if ! command -v java >/dev/null 2>&1; then
    echo 0
    return
  fi
  java -version 2>&1 | head -1 | sed -E 's/.* version "([0-9]+).*/\1/'
}

install_java() {
  local major
  major="$(java_major)"
  if [[ "$major" -ge 17 && "$major" -le 21 ]]; then
    return
  fi
  local dest="$CACHE/jdk-17"
  if [[ ! -x "$dest/bin/java" ]]; then
    echo "Installing Temurin 17 into $dest (system Java is $major)"
    curl -fsSL "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse?project=jdk" -o "$CACHE/jdk17.tar.gz"
    rm -rf "$dest"
    mkdir -p "$dest"
    tar -xzf "$CACHE/jdk17.tar.gz" -C "$dest" --strip-components=1
  fi
  export JAVA_HOME="$dest"
  export PATH="$JAVA_HOME/bin:$PATH"
}

install_android_sdk() {
  if [[ -n "${ANDROID_HOME:-}" && -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
    export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:${PATH}"
    return
  fi
  export ANDROID_HOME="$CACHE/android-sdk"
  local sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
  if [[ ! -x "$sdkmanager" ]]; then
    echo "Installing Android command-line tools into $ANDROID_HOME"
    curl -fsSL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o "$CACHE/cmdline-tools.zip"
    rm -rf "$CACHE/cmdline-tmp"
    mkdir -p "$CACHE/cmdline-tmp" "$ANDROID_HOME/cmdline-tools"
    unzip -q "$CACHE/cmdline-tools.zip" -d "$CACHE/cmdline-tmp"
    rm -rf "$ANDROID_HOME/cmdline-tools/latest"
    mv "$CACHE/cmdline-tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  fi
  export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
  set +o pipefail
  yes | sdkmanager --licenses >/dev/null
  set -o pipefail
  sdkmanager "platform-tools" "platforms;android-34" "platforms;android-35" "build-tools;34.0.0" "build-tools;35.0.0"
}

install_node
install_java
install_android_sdk

cd "$CLIENT"
npm ci
npm run build
if [[ ! -f android/app/build.gradle ]]; then
  npx cap add android
fi
npx cap sync android
python3 "$ROOT/scripts/mobile/apply-native.py"
MARKER_SO="$CLIENT/android/app/src/main/jniLibs/arm64-v8a/libcomforce_arch.so"
if [[ ! -f "$MARKER_SO" ]]; then
  mkdir -p "$(dirname "$MARKER_SO")"
  if ! clang --target=aarch64-linux-android34 -shared -fPIC -nostdlib -o "$MARKER_SO" "$ROOT/scripts/mobile/arm-marker.c"; then
    echo "The arm64 marker library is missing and clang could not build it." >&2
    exit 1
  fi
fi

cd "$CLIENT/android"
chmod +x ./gradlew
./gradlew assembleDebug --no-daemon

APK="$(find app/build/outputs/apk/debug -type f -name '*.apk' | head -1)"
if [[ -z "$APK" ]]; then
  echo "Gradle finished without an APK." >&2
  exit 1
fi
cp "$APK" "$OUT/ComForceMKE-arm64.apk"
echo "Wrote $OUT/ComForceMKE-arm64.apk"
