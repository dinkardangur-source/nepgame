import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.himalayanrealms.strategy',
  appName: 'Himalayan Realms',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0e14',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
