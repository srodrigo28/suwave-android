// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// zustand/middleware exporta ./esm/middleware.mjs quando Metro usa a condição
// "import" (modo ESM no web). Esse arquivo usa import.meta.env e quebra no browser.
// A versão CJS (middleware.js) é idêntica em funcionalidade — forçamos ela aqui.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand/middleware') {
    console.log('[metro-fix] zustand/middleware → CJS (platform:', platform, ')');
    return {
      filePath: path.resolve(__dirname, 'node_modules/zustand/middleware.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
