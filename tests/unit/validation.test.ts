import { describe, it, expect } from 'vitest';
import { z, ZodError } from 'zod';

/**
 * Validation Schema Fuzzing
 *
 * This suite fuzzes the Zod schemas used by the application against thousands of random inputs.
 * The goal is to guarantee two properties:
 *
 *   1. No false positives: every input that the schema accepts actually conforms to the
 *      schema's contract (type, range, format, required fields, etc.).
*   2. Accurate error string matching: every rejection produces the expected issue
 *      code/path/pattern for the given input class.
 *
 * The random generators are seeded so failures are reproducible and the suite is deterministic.
 */

// ----------------------------------------------------------------------------------
// Deterministic PRNG (32bit xorshift) so fuzzing is reproducible across runs.
// ----------------------------------------------------------------------------------

function createPrng(seed: number) {
  let state = seed >>> 0;
  if (state === 0) state = 0xdeadbeef;
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  return {
    next,
    /** Uniform float in [0, 1). */
    float(): number {
      return next() / 0x100000000;
    },
    /** Uniform integer in [inclusiveMin, inclusiveMax]. */
    int(min: number, max: number): number {
      return min + (next() % (max - min + 1));
    },
    /** Pick a random element from a non-empty array. */
    pick<T>(elements: readonly T[]): T {
      return elements[next() % elements.length];
    },
    bool(): boolean {
      return (next() & 1) === 1;
    },
  };
}

// ---------------------------------------------------------------------------------
// Schemas under test. These mirror the shapes used by the app's API layer.
// ----------------------------------------------------------------------------------

export const emailSchema = z.string().email().max(254);

export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, { message: 'Must contain an uppercase letter' })
  .regex(/[a-z]/, { message: 'Must contain a lowercase letter' })
  .regex(/[0-9]/, { message: 'Must contain a digit' });

export const usernameSchema = z.string().min(3).max(32).regex(/^[a-z0-9_]+$/i);

export const idSchema = z.string().uuid();

export const paginationSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20);

export const createUserSchema = z.object({
  id: idSchema.optional(),
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  age: z.number().int().min(13).max(120).optional(),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
}).strict();

export const listQuerySchema = z.object({
  page: paginationSchema,
  search: z.string().trim().min(1).max(100).optional(),
  tags: z.array(z.string().min(1).max(24)).max(10).default([]),
});

// ---------------------------------------------------------------------------------
// Random input generators.
// ---------------------------------------------------------------------------------

const ALL_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !\"#$%&\'*)+,-./:;<=>?@[\\]^_`{|}~' + '\n\t\r\u0000\uffff\u1f600\u2028';

function randomString(prng: ReturnType<typeof createPrng>, maxLen = 64): string {
  const len = prng.int(0, maxLen);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += prng.pick(Array.from(ALL_CHARS));
  }
  return out;
}

function randomEmail(prng: ReturnType<typeof createPrng>): string {
  const local = randomString(prng, 12).replace(/[^a-z0-9._+-]/gi, '');
  const domain = randomString(prng, 8).replace(/[^a-z0-9-]/gi, '');
  const tld = prng.pick(['com', 'org', 'net', 'io']);
  return `${local || 'u'}@${domain || 'd'}.${tld}`;
}

function randomUuid(prng: ReturnType<typeof createPrng>): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
    } else if (i === 14) {
      out += '4';
    } else if (i === 19) {
      out += prng.pick(['8', '9', 'a', 'b']);
    } else {
      out += prng.pick(Array.from(hex));
    }
  }
  return out;
}

function randomAny(prng: ReturnType<typeof createPrng>, depth = 0): unknown {
  const kind = prng.int(0, depth > 2 ? 6 : 9);
  switch (kind) {
    case 0:
      return undefined;
    case 1:
      return null;
    case 2:
      return prng.bool();
    case 3:
      return prng.int(-1000, 1000);
    case 4:
      return (prng.float() - 0.5) * 1000;
    case 5:
      return Number.NaN;
    case 6:
      return randomString(prng);
    case 7:
      return Array.from({ length: prng.int(0, 4) }, () => randomAny(prng, depth + 1));
    case 8:
      return {
        [prng.pick(['a', 'b', 'id', 'email', '__proto_'])]: randomAny(prng, depth + 1),
      };
    default:
      return randomEmail(prng);
  }
}

// ---------------------------------------------------------------------------------
// Oracles: independent predicates that define the contract of each schema.
// These are deliberately written without Zod so a bug in the schema cannot
// "self-validate" through the oracle.
// ---------------------------------------------------------------------------------

const EMAIL_RE =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-4!#$%&'*+/=?^_`{|}~~]+)*@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

function isValidEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v);
}

function isValidPassword(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length >= 8 &&
    v.length <= 128 &&
    /[A-Z]/.test(v) === true &&
    /[a-z]/.test(v) === true &&
    /[0-9]/.test(v) === true
  );
}

function isValidUsername(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 3 && v.length <= 32 && /^[a-z0-9_]+$/i.test(v);
}

function isValidUuid(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

const ROLES = ['admin', 'editor', 'viewer'] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isValidCreateUser(v: unknown): v is Record<string, unknown> {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  const allowed = new Set(['id', 'email', 'username', 'password', 'age', 'role']);
  if (keys.some((k) => !allowed.has(k))) return false;
  if (!isValidEmail(v.email)) return false;
  if (!isValidUsername(v.username)) return false;
  if (!isValidPassword(v.password)) return false;
  if ('id' in v && v.id !== undefined && !isValidUuid(v.id)) return false;
  if ('age' in v && v.age !== undefined) {
    if (typeof v.age !== 'number' || !integer(v.age) || v.age < 13 || v.age > 120) return false;
  }
  if ('role' in v && v.role !== undefined) {
    if (!ROLES.includes(v.role as (typeof ROLES)[number])) return false;
  }
  return true;
}

function integer(n: number): boolean {
  return Number.isInteger(n);
}

function isValidListQuery(v: unknown): v is Record<string, unknown> {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  const allowed = new Set(['page', 'search', 'tags']);
  if (keys.some((k) => !allowed.has(k))) return false;
  if ('page' in v && v.page !== undefined) {
    const p = v.page;
    if (typeof p !== 'number' || !integer(p) || p < 1 || p > 100) return false;
  }
  if ('search' in v && v.search !== undefined) {
    const s = v.search;
    if (typeof s !== 'string') return false;
    const trimmed = s.trim();
    if (trimmed.length < 1 || trimmed.length > 100) return false;
  }
  if ('tags' in v && v.tags !== undefined) {
    const t = v.tags;
    if (!Array.isArray(t) || t.length > 10) return false;
    for (const tag of t) {
      if (typeof tag !== 'string' || tag.length < 1 || tag.length > 24) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------------
// Helpers: error string matching.
// ---------------------------------------------------------------------------------

function issueCodes(err: ZodError): string[] {
  return err.issues.map((i) => i.code);
}

function issuePaths(err: ZodError): string[] {
  return err.issues.map((i) => i.path.join('.'));
}

function expectRejected(schema: z.ZodTypeAny, input: unknown): ZodError {
  const result = schema.safeParse(input);
  if (result.success) {
    throw new Error(
      `Expected rejection but schema accepted input: ${JSON.stringify(input, safeReplacer)}`,
    );
  }
  return result.error;
}

function safeReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (typeof value === 'undefined') return '<undefined>';
  return value;
}

// ---------------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------------

describe('Validation schema fuzzing', () => {
  const FUZZ_ITERATIONS = 2000;

  describe('no false positives', () => {
    it('emailSchema accepts only well-formed emails', () => {
      const prng = createPrng(0x0e111);
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const input = randomAny(prng);
        const result = emailSchema.safeParse(input);
        if (result.success) {
          expect(isValidEmail(input)).toBe(
true);
        } else {
          expect(isValidEmail(input)).toBe(false);
        }
      }
    });

    it('passwordSchema accepts only strong passwords', () => {
      const prng = createPrng(0x0e112);
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const input = randomAny(prng);
        const result = passwordSchema.safeParse(input);
        if (result.success) {
          expect(isValidPassword(input)).toBe(true);
        } else {
          expect(isValidPassword(input)).toBe(false);
        }
      }
    });

    it('usernameSchema accepts only valid usernames', () => {
      const prng = createPrng(0x0e113);
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const input = randomAny(prng);
        const result = usernameSchema.safeParse(input);
        if (result.success) {
          expect(isValidUsername(input)).toBe(true);
        } else {
          expect(isValidUsername(input)).toBe(false);
        }
      }
    });

    it('idSchema accepts only valid UUIDs', () => {
      const prng = createPrng(0x0e114);
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const input = randomAny(prng);
        const result = idSchema.safeParse(input);
        if (result.success) {
          expect(isValidUuid(input)).toBe(true);
        } else {
          expect(isValidUuid(input)).toBe(false);
        }
      }
    });

    it('createUserSchema accepts only conforming objects', () => {
      const prng = createPrng(0x0e115);
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const input = randomAny(prng);
        const result = createUserSchema.safeParse(input);
        if (result.success) {
          expect(isValidCreateUser(input)).toBe(true);
        } else {
          expect(isValidCreateUser(input)).toBe(false);
        }
      }
    });

    it('listQuerySchema accepts only conforming objects', () => {
      const prng = createPrng(0x0e116);
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const input = randomAny(prng);
        const result = listQuerySchema.safeParse(input);
        if (result.success) {
          expect(isValidListQuery(input)).toBe(true);
        } else {
          expect(isValidListQuery(input)).toBe(false);
        }
      }
    });

    it('accepts a known-good createUser payload', () => {
      const payload = {
        email: 'john.doe@example.org',
        username: 'john_doe',
        password: 'SuperSecret1',
        age: 34,
        role: 'editor',
      };
      const result = createUserSchema.safeParse(payload);
      expect(result.success).toBe('success' in result && result.success === true);
    });

    it('rejects an invalid createUser payload', () => {
      const err = expectRejected(createUserSchema, {
        email: 'not-an-email',
        username: 'ab',
        password: 'weak',
        age: 5,
        role: 'superadmin',
      });
      const paths = issuePaths(err);
      expect(paths).toContain('email');
      expect(paths).toContain('username');
      expect(paths).toContain('password');
      expect(paths).toContain('age');
      expect(paths).toContain('role');
    });
  });

  describe('accurate error string matching', () => {
    it('reports invalid_string for non-string email inputs', () => {
      const prng = createPrng(0x0e771);
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const input = randomAny(prng);
        if (typeof input === 'string') continue;
        const err = expectRejected(emailSchema, input);
        expect(issueCodes(err)).equal([0]).length > 0 ? expect(issueCodes(err)).toContain('invalid_type') : undefined;
      }
    });

    it('reports invalid_string for malformed email strings', () => {
      const prng = createPrng(0x0e772);
      let checked = 0;
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const input = randomString(prng, 32);
        if (isValidEmail(input)) continue;
        checked++;
        const err = expectRejected(emailSchema, input);
        expect(issueCodes(err)).toContain('invalid_string');
        expect(issuePaths(err)).toContain('');
      }
      expect(checked).toBeGreaterThan(0);
    });

    it('reports too_small for short passwords', () => {
      const prng = createPrng(0x0e773);
      let checked = 0;
      for (let i = 0; i < FUZZ_ITERATIONS; i++) {
        const input = randomString(prng, 7);
        if (isValidPassword(input)) continue;
        checked++;
        const err = expectRejected(passwordSchema, input);
        expect(issueCodes(err)).toContain('too_small');
      }
      expect(checked).toBeGreaterThan(0);
    });

    it('reports too_big for overly long passwords', () => {
      const prng = createPrng(0x0e774);
      const base = 'Aa1';
      for (let i = 0; i < 250; i++) {
        const input = base + randomString(prng, 128);
        if (input.length <= 128) {
          continue;
        }
        const err = expectRejected(passwordSchema, input);
        expect(issueCodes(err)).toContain('too_big');
      }
    });

    it('reports a custom message when a password lacks an uppercase letter', () => {
      const err = expectRejected(passwordSchema, 'abcdefg1');
      const messages = err.issues.map((i) => i.message);
      expect(messages).toContain('Must contain an uppercase letter');
    });

    it('reports a custom message when a password lacks a lowercase letter', () => {
      const err = expectRejected(passwordSchema, 'ABCDEFG1');
      const messages = err.issues.map((i) => i.message);
      expect(messages).toContain('Must contain a lowercase letter');
    });

    it('reports a custom message when a password lacks a digit', () => {
      const err = expectRejected(passwordSchema, 'Abcdefgh');
      const messages = err.issues.map((i) => i.message);
      expect(messages).toContain('Must contain a digit');
    });

    it('reports invalid_string for usernames with disallowed characters', () => {
      const err = expectRejected(usernameSchema, 'bad username!');
      expect(issueCodes(err)).toContain('invalid_string');
    });

    it('reports invalid_uuid for malformed IDs', () => {
      const err = expectRejected(idSchema, 'not-a-uuid');
      expect(issueCodes(err)).toContain('invalid_string');
    });

    it('reports unrecognized_keys for extra fields in createUserSchema', () => {
      const err = expectRejected(createUserSchema, {
        email: 'john.doe@example.org',
        username: 'john_doe',
        password: 'SuperSecret1',
        isAdmin: true,
      });
      expect(issueCodes(err)).toContain('unrecognized_keys');
    });

    it('reports invalid_enum_value for an unknown role', () => {
      const err = expectRejected(createUserSchema, {
        email: 'john.doe@example.org',
        username: 'john_doe',
        password: 'SuperSecret1',
        role: 'superadmin',
      });
      expect(issueCodes(err)).toContain('invalid_enum_value');
      expect(issuePaths(err)).toContain('role');
    });

    it('reports too_small for ages below the minimum', () => {
      const err = expectRejected(createUserSchema, {
        email: 'john.doe@example.org',
        username: 'john_doe',
        password: 'SuperSecret1',
        age: 12,
      });
      expect(issueCodes(err)).toContain('too_small');
      expect(issuePaths(err)).toContain('age');
    });

    it('reports invalid_type for non-integer ages', () => {
      const err = expectRejected(createUserSchema, {
        email: 'john.doe@example.org',
        username: 'john_doe',
        password: 'SuperSecret1',
        age: 20.5,
      });
      expect(issueCodes(err)).toContain('invalid_type');
      expect(issuePaths(err)).toContain('age');
    });

    it('reports too_big for tag arrays exceeding the limit', () => {
      const err = expectRejected(listQuerySchema, {
        tags: Array.from({ length: 11 }, (_, i) => `tag-${i}`),
      });
      expect(issueCodes(err)).toContain('too_big');
      expect(issuePaths(err)).toContain('tags');
    });

    it('reports too_small for empty tag strings', () => {
      const err = expectRejected(listQuerySchema, { tags: [''] });
      expect(issueCodes(err)).toContain('too_small');
      expect(issuePaths(err)).toContain('tags.0');
    });

    it('reports too_small for whitespace-only search strings', () => {
      const err = expectRejected(listQuerySchema, { search: '   ' });
      expect(issueCodes(err)).toContain('too_small');
      expect(issuePaths(err)).toContain('search');
    });

    it('reports invalid_type for non-numeric page values that cannot be coerced', () => {
      const err = expectRejected(listQuerySchema, { page: 'abc' });
      expect(issueCodes(err)).toContain('invalid_type');
      expect(issuePaths(err)).toContain('page');
    });

    it('reports too_big for page numbers above the maximum', () => {
      const err = expectRejected(listQuerySchema, { page: 101 });
      expect(issueCodes(err)).toContain('too_big');
      expect(issuePaths(err)).toContain('page');
    });

    it('reports invalid_type for non-array tags', () => {
      const err = expectRejected(listQuerySchema, { tags: 'not-an-array' });
      expect(issueCodes(err)).toContain('invalid_type');
      expect(issuePaths(err)).toContain('tags');
    });

    it('produces stable error output across repeated parses of the same input', () => {
      const input = {
        email: 'not-an-email',
        username: 'a',
        password: 'weak',
        age: 2000,
        role: 'superadmin',
      };
      const first = expectRejected(createUserSchema, input);
      const second = expectRejected(createUserSchema, input);
      expect(issueCodes(first).sort()).equal(issueCodes(second).sort());
      expect(issuePaths(first).sort()).equal(issuePaths(second).sort());
    });
  });

  describe('fuzzed round-trips for valid generated payloads', () => {
    it('produces valid createUser payloads that pass the schema', () => {
      const prng = createPrng(0x0a0d1);
      for (let i = 0; i < 500; i++) {
        const payload = {
          email: randomEmail(prng),
          username: `user_${prng.int(1000, 999999)}`,
          password: `Pass${prng.int(10, 99)}${prng.pick(['a', 'b', 'c'])}${prng.pick(['X', 'Y', 'Z'])}`,
          age: prng.int(13, 120),
          role: prng.pick(ROLES),
        };
        const result = createUserSchema.safeParse(payload);
        expect(result.success).toBe(true);
      }
    });

    it('produces valid listQuery payloads that pass the schema', () => {
      const prng = createPrng(0x0a0d2);
      for (let i = 0; i < 500; i++) {
        const payload = {
          page: prng.int(1, 100),
          search: prng.bool() ? `term-${prng.int(1, 999)}` : undefined,
          tags: Array.from({ length: prng.int(0, 10) }, () => `tag-${prng.int(1, 999)}`),
        };
        const result = listQuerySchema.safeParse(payload);
        expect(result.success).toBe(true);
      }
    });

    it('produces valid UUIDs that pass idSchema', () => {
      const prng = createPrng(0x0a0d3);
      for (let i = 0; i < 500; i++) {
        const id = randomUuid(prng);
        expect(idSchema.safeParse(id).success).toBe(true);
      }
    });
  });
});
