import { defineConfig } from 'drizzle-kit';

// Generation is offline: credentials are never loaded into the Kit config.
export default defineConfig({
  dialect: 'postgresql', schema: './src/db/schema.ts', out: './drizzle',
});
