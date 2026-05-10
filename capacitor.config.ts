import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.facedoor.app',
  appName: 'Face Door System',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'tfhub.dev',
      'www.kaggle.com',
      'kaggle.com',
      'storage.googleapis.com',
    ],
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
