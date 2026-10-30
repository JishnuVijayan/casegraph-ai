module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', setupFiles: ['<rootDir>/test/env.setup.cjs'],
  testMatch: ['**/test/claims.integration.test.ts', '**/test/prepare.integration.test.ts'],
};
