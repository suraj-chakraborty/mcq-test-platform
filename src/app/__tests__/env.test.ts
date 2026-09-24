import { validateEnv } from '../lib/env';

describe('Environment Validation (fail-fast startup check)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows development mode even with partial configuration', () => {
    (process.env as any).NODE_ENV = 'development';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    process.env.NEXTAUTH_SECRET = 'supersecretlongenough123456';

    expect(() => validateEnv()).not.toThrow();
  });

  it('throws in production when MONGODB_URI is missing', () => {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.MONGODB_URI;
    process.env.NEXTAUTH_SECRET = 'supersecretlongenough123456';

    expect(() => validateEnv()).toThrow(/CRITICAL CONFIGURATION ERROR/);
  });

  it('throws in production when Upstash Redis is missing', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.MONGODB_URI = 'mongodb+srv://cluster.example.mongodb.net/';
    process.env.NEXTAUTH_SECRET = 'supersecretlongenough123456';
    process.env.GOOGLE_AI_API_KEY = 'AIzaSyFakeKey';
    process.env.CLOUDINARY_CLOUD_NAME = 'demo';
    process.env.CLOUDINARY_API_KEY = '12345';
    process.env.CLOUDINARY_API_SECRET = 'secret';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    expect(() => validateEnv()).toThrow(/Upstash Redis/);
  });
});
