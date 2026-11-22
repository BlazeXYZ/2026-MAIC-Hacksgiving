import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.comforcemke.hub',
  appName: 'ComForce MKE',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    // The shell navigates the web view to the saved Tailscale address or LAN host.
    // A response from that dashboard must not be replaced by the packaged error page.
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#0F6B3A',
      showSpinner: false,
    },
  },
};

export default config;
