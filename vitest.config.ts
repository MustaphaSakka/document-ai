import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      AWS_REGION: 'us-east-1',
      AWS_S3_BUCKET_NAME: 'test-bucket',
      NODE_ENV: 'test',
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
