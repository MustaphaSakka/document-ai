import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/config.js';

export default defineConfig({
  test: {
    env: {
      AWS_REGION: 'us-east-1',
      AWS_S3_BUCKET_NAME: 'test-bucket',
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
    },
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    // Every file shares one database and empties it between tests, so running
    // files in parallel would have them deleting each other's rows.
    fileParallelism: false,
  },
});
