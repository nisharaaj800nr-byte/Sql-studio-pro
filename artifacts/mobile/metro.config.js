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
      // Replit's preview proxy forwards requests with an Origin of
      // https://<id>.sisko.replit.dev:3000 (the external port used by the
      // proxy). Expo's CorsMiddleware only allows localhost:<port> and the
      // EXPO_PACKAGER_PROXY_URL origin, so it rejects these requests and
      // breaks hot-reload inside the Replit preview pane.
      // Fix: rewrite any *.replit.dev origin to the localhost equivalent
      // before the request reaches CorsMiddleware so the check passes.
      const origin = req.headers['origin'];
      if (origin && origin.includes('.replit.dev')) {
        const port = process.env.PORT || 18115;
        req.headers['origin'] = `http://localhost:${port}`;
      }

      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
