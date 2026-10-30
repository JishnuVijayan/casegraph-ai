module.exports = { preset: 'ts-jest', testEnvironment: 'node', setupFiles: ['<rootDir>/test/env.setup.cjs'], testMatch: ['**/test/investigations.integration.test.ts'], testTimeout:30000 };
