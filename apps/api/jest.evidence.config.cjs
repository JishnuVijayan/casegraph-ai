module.exports = { preset: 'ts-jest', testEnvironment: 'node', setupFiles: ['<rootDir>/test/env.setup.cjs'], testMatch: ['**/test/evidence.integration.test.ts'], testTimeout: 30000 };
