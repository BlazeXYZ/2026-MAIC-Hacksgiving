# ComForce MKE Client Application

Cross-platform React and TypeScript client built with Vite, Tailwind CSS, OpenStreetMap, and Capacitor.

## Web Development

Install packages and start the Vite development server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. API requests to `/api` are automatically proxied to the FastAPI server at `http://localhost:8000`.

---

## Mobile Build & Device Sync Workflow (Capacitor)

The mobile client is packaged using **Capacitor 6** to produce native Android and iOS applications with a unified codebase.

### 1. Build and Sync

Compile the React frontend bundle and copy the distribution assets to native platforms:

```bash
npm run build
npx cap sync
```

This ensures `src/client/dist` is populated and synchronized with native platform assets.

### 2. Browser Mobile Emulation & Testing

For fast local testing of touch interactions, mobile safe areas, and responsive layouts:

1. Start the dev server: `npm run dev`
2. Open Chrome DevTools (`F12` or `Ctrl+Shift+I` / `Cmd+Option+I`)
3. Toggle the Device Toolbar (`Ctrl+Shift+M` / `Cmd+Option+M`)
4. Select a mobile preset (e.g., **iPhone 14 Pro**, **Pixel 7**, or **Samsung Galaxy S20**)
5. Verify:
   - **Safe area insets:** The sticky emergency alert banner and navigation respect top notch / Dynamic Island and bottom gesture pill bar (`viewport-fit=cover` and `env(safe-area-inset-*)`).
   - **Touch targets:** All buttons, community selector pills, and ticket claim actions have a minimum touch target of 44x44px.

### 3. Native shell

On a phone the app opens a connect screen. Type an IPv4 address or hostname and a port, then **Save and open**. A Tailscale address such as `100.64.0.1` is saved on the device (Android SharedPreferences, iOS UserDefaults) and the web view loads `http://address:port/`. The dashboard stays in the web view; the connect screen does not take it back. A **Server** button on the remote page returns to the picker. In a desktop browser, open `http://localhost:3000/?shell=1` to preview the picker.

### 4. Build pipeline

From the repository root:

```bash
bash scripts/mobile/build-android.sh
bash scripts/mobile/build-ios.sh
```

- Android (Linux or macOS) writes `dist/mobile/ComForceMKE-arm64.apk`. It is a debug APK that contains only the arm64-v8a ABI. Install it on an arm64 phone with USB debugging or by copying the file over.
- iOS needs macOS and Xcode. It writes `dist/mobile/ComForceMKE-unsigned.ipa` (arm64, unsigned). A device install needs a re-sign.

GitHub Actions workflow **Mobile apps** runs the same scripts and uploads both files. The script installs a local JDK 17 and Android SDK under `~/.cache/comforce-mobile` when the machine does not already have them.

Android Studio and Xcode can still open the synced projects with `npm run cap:android` and `npm run cap:ios`.
