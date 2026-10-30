module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', setupFiles: ['<rootDir>/test/env.setup.cjs'],
  testMatch: ['**/test/intake.integration.test.ts'],
};
