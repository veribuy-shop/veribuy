const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Shared, dependency-free domain code (rate engine, evidence rules) is compiled
// from source, so mobile can never drift from the backend and web.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../packages/common')];

module.exports = withNativeWind(config, { input: './global.css' });
