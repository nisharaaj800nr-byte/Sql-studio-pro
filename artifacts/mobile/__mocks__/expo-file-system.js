'use strict';

/** Minimal expo-file-system mock for Jest (sqliteManager uses documentDirectory & getInfoAsync). */
module.exports = {
  documentDirectory: '/tmp/mock-fs/',
  getInfoAsync: async (_path) => ({ exists: false, isDirectory: false, size: 0 }),
  deleteAsync: async (_path, _opts) => {},
  makeDirectoryAsync: async (_path, _opts) => {},
  readAsStringAsync: async (_path, _opts) => '',
  writeAsStringAsync: async (_path, _content, _opts) => {},
};
