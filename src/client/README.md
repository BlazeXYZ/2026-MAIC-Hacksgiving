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
   - **Quick Exit gesture:** The prominent red "Quick Exit" button triggers immediately and smoothly displays the transit disguise screen.

### 3. Native Platform Export

#### Android
Ensure Android Studio and Android SDK 33+ are installed:
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
