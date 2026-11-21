# ComForce MKE Client Application

Cross-platform React and TypeScript client built with Vite, Tailwind CSS, OpenStreetMap, and Capacitor.

## Web Development

Install packages and start the Vite development server:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` in your browser. API requests to `/api` are automatically proxied to the FastAPI server at `http://localhost:8000`.

---

## Mobile Build & Device Sync Workflow (Capacitor)

The mobile client is packaged using **Capacitor 6** to produce native Android and iOS applications with a unified codebase.

### 1. Build and Sync

Run `npm ci` in `src/client`. The lockfile includes both native platforms. Create
`src/client/.env.local` with the public HTTPS origin the device can reach.

```dotenv
VITE_API_ORIGIN=https://api.example.org
```

Use the deployed ComForce origin that serves `/api`, with a trusted TLS
certificate. The bundled WebView uses this origin for API requests. Its built-in
origins are `https://localhost` on Android and `capacitor://localhost` on iOS.

Build the frontend, then add or sync the relevant platform as described below.

```bash
npm run build
```

Rebuild and run `npx cap sync android` or `npx cap sync ios` after changing the API origin.

### 2. Browser Mobile Emulation & Testing

For fast local testing of touch interactions, mobile safe areas, and responsive layouts:

1. Start the dev server: `npm run dev`
2. Open Chrome DevTools (`F12` or `Ctrl+Shift+I` / `Cmd+Option+I`)
3. Toggle the Device Toolbar (`Ctrl+Shift+M` / `Cmd+Option+M`)
4. Select a mobile preset (e.g., **iPhone 14 Pro**, **Pixel 7**, or **Samsung Galaxy S20**)
5. Verify:
   - **Safe area insets:** The sticky emergency alert banner and navigation respect top notch / Dynamic Island and bottom gesture pill bar (`viewport-fit=cover` and `env(safe-area-inset-*)`).
   - **Touch targets:** All buttons, community selector pills, and ticket claim actions have a minimum touch target of 44x44px.

### 3. Native Platform Export

#### Android
Install Android Studio and the Android SDK specified by the generated Gradle project.
```bash
# Add Android platform (first-time setup)
npx cap add android

# Sync assets and open in Android Studio
npx cap sync android
npm run cap:android
```
In Android Studio:
- Select an active emulator or connected hardware device (with USB debugging enabled).
- Click **Run 'app'** (`Shift+F10`).

#### iOS (macOS only)
Ensure Xcode and CocoaPods are installed:
```bash
# Add iOS platform (first-time setup)
npx cap add ios

# Sync assets and open in Xcode
npx cap sync ios
npm run cap:ios
```
In Xcode:
- Select a simulator (e.g., iPhone 15 Pro).
- Click **Play / Run** (`Cmd+R`).

### 4. Device smoke test

Run the app on an emulator or device against a test API deployment. Use sample
details to verify these paths.

1. Open **Map** and confirm the resource list loads from the configured API.
2. Open **Ask for help**, submit a sample request, and confirm the API returns a request code.
3. Open **Staff sign in** with a test coordinator key. Confirm the queue loads with the key and rejects an invalid key.
4. Check the WebView network log for requests to the configured HTTPS origin.
