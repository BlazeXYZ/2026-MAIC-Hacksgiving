import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.comforcemke.hub',
  appName: 'ComForce MKE',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
