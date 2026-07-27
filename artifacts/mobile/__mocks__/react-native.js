'use strict';

// sqliteManager only needs Platform in the Node-based integration tests.
// Avoid loading React Native's ESM entrypoint into Jest.
module.exports = {
  Platform: {
    OS: 'ios',
    select: (spec) => spec.ios ?? spec.default,
  },
};