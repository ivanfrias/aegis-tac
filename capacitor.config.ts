import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aegistac.radar',
  appName: 'Aegis Tac',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
