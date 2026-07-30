import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.slipstream.community',
  appName: 'Slipstream',
  webDir: 'dist',
  android: {
    useLegacyBridge: true,
  },
};

export default config;
