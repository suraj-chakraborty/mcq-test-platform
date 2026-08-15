import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@google/genai$': '<rootDir>/src/app/__mocks__/google-genai.ts',
    '^@/app/lib/auth$': '<rootDir>/src/app/__mocks__/auth.ts',
    '^next-auth/react$': '<rootDir>/src/app/__mocks__/next-auth-react.ts',
    '^next-auth$': '<rootDir>/src/app/__mocks__/next-auth.ts',
    // Handle module aliases (this will be same as in your tsconfig.json)
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/src/app/lib/validations/test.ts',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
