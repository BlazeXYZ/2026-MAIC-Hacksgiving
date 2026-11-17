# ComForce MKE Client Application

Cross-platform React and TypeScript client built with Vite, Tailwind CSS, OpenStreetMap, and Capacitor.

## Web Development

Install packages and start the Vite development server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. API requests to `/api` are automatically proxied to the FastAPI server at `http://localhost:8000`.

## Mobile Build (Capacitor)

Compile the web application and sync native mobile platforms:

```bash
npm run build
npx cap sync
```

To open in Android Studio or Xcode:
```bash
npm run cap:android
npm run cap:ios
```
