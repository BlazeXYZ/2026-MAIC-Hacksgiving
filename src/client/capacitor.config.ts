import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.comforcemke.hub',
  appName: 'ComForce MKE',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    Haptics: {},
    App: {}
  }
};

export default config;
