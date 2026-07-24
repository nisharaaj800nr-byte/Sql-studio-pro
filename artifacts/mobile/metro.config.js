const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 1. Support .wasm files so expo-sqlite's wa-sqlite.wasm is bundled on web
config.resolver.assetExts.push('wasm');

// 2. Inject Cross-Origin headers required for SharedArrayBuffer (expo-sqlite web worker)
//    Without these, Atomics.wait & SharedArrayBuffer are disabled by the browser and
//    the wa-sqlite worker cannot initialise, so openDatabaseAsync silently fails on web.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
