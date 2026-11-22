#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLIENT="$ROOT/src/client"
SCRATCH="$(mktemp -d)"
API="https://127.0.0.1:18443"
cleanup() {
  if [[ -n "${server_pid:-}" ]]; then kill "$server_pid" 2>/dev/null || true; fi
  if [[ -n "${device:-}" ]]; then xcrun simctl shutdown "$device" || true; fi
}
trap cleanup EXIT

# The simulator trusts this ephemeral CA only for this run.
cat > "$SCRATCH/openssl.cnf" <<'EOF'
[req]
distinguished_name = dn
[dn]
[ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
[leaf]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = IP:127.0.0.1
EOF
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj '/CN=ComForce CI CA' \
  -config "$SCRATCH/openssl.cnf" -extensions ca -keyout "$SCRATCH/ca.key" -out "$SCRATCH/ca.pem" 2>/dev/null
openssl req -new -newkey rsa:2048 -nodes -subj '/CN=127.0.0.1' \
  -config "$SCRATCH/openssl.cnf" -keyout "$SCRATCH/server.key" -out "$SCRATCH/server.csr" 2>/dev/null
openssl x509 -req -days 2 -in "$SCRATCH/server.csr" -CA "$SCRATCH/ca.pem" \
  -CAkey "$SCRATCH/ca.key" -CAcreateserial -extfile "$SCRATCH/openssl.cnf" -extensions leaf \
  -out "$SCRATCH/server.pem"

device="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
print(next(d["udid"] for runtime, entries in reversed(list(devices.items()))
           if ".iOS-" in runtime for d in entries if d["name"].startswith("iPhone")))
')"
xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b
xcrun simctl keychain "$device" add-root-cert "$SCRATCH/ca.pem"

cd "$CLIENT"
npm ci
VITE_API_ORIGIN="$API" npm run build
cp "$ROOT/scripts/mobile/smoke-ios-client.js" dist/smoke-ios-client.js
python3 -c 'from pathlib import Path; p = Path("dist/index.html"); p.write_text(p.read_text().replace("</body>", "<script src=\"/smoke-ios-client.js\"></script></body>"))'
npx cap sync ios
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator \
  -destination "id=$device" -derivedDataPath "$SCRATCH/derived" \
  CODE_SIGNING_ALLOWED=NO COMPILER_INDEX_STORE_ENABLE=NO -quiet build
xcrun simctl install "$device" "$SCRATCH/derived/Build/Products/Debug-iphonesimulator/App.app"
python3 "$ROOT/scripts/mobile/smoke-ios-api.py" "$SCRATCH" &
server_pid=$!
curl --retry 12 --retry-connrefused --retry-delay 1 --fail --silent --cacert "$SCRATCH/ca.pem" "$API/health"
xcrun simctl launch "$device" com.comforcemke.hub
wait "$server_pid"
unset server_pid
