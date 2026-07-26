/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-haptics$': '<rootDir>/__mocks__/expo-haptics.js',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: false,
        },
      },
    ],
  },
  testTimeout: 15000,
};
