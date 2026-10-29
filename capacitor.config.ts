import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aegistac.radar',
  appName: 'AegisTac Radar',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
