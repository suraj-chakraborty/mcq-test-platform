import { registerSchema, loginSchema } from '@/app/lib/validations/auth';

describe('Auth Zod Schemas', () => {
  describe('registerSchema', () => {
    it('should validate correct data', () => {
      const data = { name: 'John Doe', email: 'john@example.com', password: 'password123' };
      expect(registerSchema.safeParse(data).success).toBe(true);
    });

    it('should fail on short name', () => {
      const data = { name: 'J', email: 'john@example.com', password: 'password123' };
      expect(registerSchema.safeParse(data).success).toBe(false);
    });

    it('should fail on invalid email', () => {
      const data = { name: 'John Doe', email: 'invalid-email', password: 'password123' };
      expect(registerSchema.safeParse(data).success).toBe(false);
    });

    it('should fail on short password', () => {
      const data = { name: 'John Doe', email: 'john@example.com', password: '123' };
      expect(registerSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate correct login', () => {
      const data = { email: 'john@example.com', password: 'password123' };
      expect(loginSchema.safeParse(data).success).toBe(true);
    });

    it('should fail on empty password', () => {
      const data = { email: 'john@example.com', password: '' };
      expect(loginSchema.safeParse(data).success).toBe(false);
    });
  });
});
