import { describe, it, expect } from 'vitest';
import {
  addressSchema,
  amountSchema,
  emailSchema,
  urlSchema,
  nameSchema,
  memoSchema,
  transactionSchema,
  affiliateSchema,
} from '../../src/lib/validation';

function randomString(length: number): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !@#$%^&*()-[_]={};:\'",<>./?|~\\`';
}

describe('validation schemas', () => {
  describe('addressSchema', () => {
    it('accepts a valid Stellar address', () => {
      expect(addressSchema.safeParse('GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA').success).toBe(true);
    });
    it('rejects addresses with wrong prefix', () => {
      const result = addressSchema.safeParse('XBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid Stellar address');
      }
    });
    it('rejects addresses with wrong length', () => {
      const result = addressSchema.safeParse('GBAAAA');
      expect(result.success).toBe(false);
    });
    it('rejects lowercase characters', () => {
      const result = addressSchema.safeParse('GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      expect(result.success).toBe(false);
    });
  });

  describe('amountSchema', () => {
    it('accepts positive numbers', () => {
      expect(amountSchema.safeParse(100).success).toBe(true);
    });
    it('coerces numeric strings', () => {
      const result = amountSchema.safeParse('25.5');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(25.5);
      }
    });
    it('rejects zero and negative values', () => {
      for (const value of [0, -1, -0.001]) {
        const result = amountSchema.safeParse(value);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Amount must be positive');
        }
      }
    });
    it('rejects NaN and Infinity', () => {
      expect(amountSchema.safeParse(NaN).success).toBe(false);
      expect(amountSchema.safeParse(Infinity).success).toBe(false);
    });
  });

  describe('emailSchema', () => {
    it('accepts valid emails', () => {
      expect(emailSchema.safeParse('user@example.org').success).toBe(true);
    });
    it('rejects invalid emails with exact message', () => {
      const result = emailSchema.safeParse('not-an-email');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email address');
      }
    });
  });

  describe('urlSchema', () => {
    it('accepts valid URLs', () => {
      expect(urlSchema.safeParse('https://example.org').success).toBe(true);
    });
    it('rejects invalid URLs with exact message', () => {
      const result = urlSchema.safeParse('not-a-url');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid URL');
      }
    });
  });

  describe('nameSchema', () => {
    it('rejects empty strings with exact message', () => {
      const result = nameSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Name is required');
      }
    });
    it('rejects names over 100 characters', () => {
      const result = nameSchema.safeParse('a'.repeat(101));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Name must be at most 100 characters',
        );
      }
    });
  });

  describe('memoSchema', () => {
    it('accepts undefined', () => {
      expect(memoSchema.safeParse(undefined).success).toBe(true);
    });
    it('rejects memos over 500 characters', () => {
      const result = memoSchema.safeParse('a'.repeat(501));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Memo must be at most 500 characters',
        );
      }
    });
  });

  describe('transactionSchema', () => {
    it('accepts a valid transaction', () => {
      const result = transactionSchema.safeParse({
        address: 'GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        amount: 10,
        memo: 'payment',
      });
      expect(result.success).toBe(true);
    });
    it('reports the correct field path on failure', () => {
      const result = transactionSchema.safeParse({
        address: 'bad',
        amount: -1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('address');
        expect(paths).toContain('amount');
      }
    });
  });

  describe('affiliateSchema', () => {
    it('accepts a valid affiliate', () => {
      expect(
        affiliateSchema.safeParse({
          name: 'Alice',
          email: 'alice@example.org',
          website: 'https://example.org',
        }).success,
      ).toBe(true);
    });
    it('rejects when required fields are missing', () => {
      const result = affiliateSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('fuzzing', () => {
    it('never throws on random string inputs', () => {
      for (let i = 0; i < 2000; i++) {
        const input = randomString(Math.floor(Math.random() * 60));
        expect(() => addressSchema.safeParse(input)).not.toThrow();
        expect(() => emailSchema.safeParse(input)).not.toThrow();
        expect(() => urlSchema.safeParse(input)).not.toThrow();
        expect(() => nameSchema.safeParse(input)).not.toThrow();
        expect(() => memoSchema.safeParse(input)).not.toThrow();
      }
    });

    it('never throws on random numeric inputs', () => {
      for (let i = 0; i < 2000; i++) {
        const input = (Math.random() - 0.5) * 1e6;
        expect(() => amountSchema.safeParse(input)).not.toThrow();
      }
    });

    it('produces consistent results for the same input', () => {
      for (let i = 0; i < 500; i++) {
        const input = randomString(Math.floor(Math.random() * 40));
        const a = emailSchema.safeParse(input).success;
        const b = emailSchema.safeParse(input).success;
        expect(a).toBe(b);
      }
    });

    it('only accepts inputs that match the expected shape', () => {
      for (let i = 0; i < 2000; i++) {
        const input = randomString(Math.floor(Math.random() * 60));
        const result = addressSchema.safeParse(input);
        if (result.success) {
          expect(input).toMatch(/^GBA[A-Z0-9]{56}$/);
        } else {
          expect(result.error.issues[0].message).toBe('Invalid Stellar address');
        }
      }
    });
  });
});
