import { describe, it, expect } from "vitest";
import {
  isValidStellarAddress,
  formatStellarAddress,
} from "../../src/lib/stellar";

/**
 * Deterministic PRNG for reproducible fuzzing across runs.
 * Uses a 32-bit xorshift variant so we don't depend on any external library.
 */
function createPrng(seed: number) {
  let state = seed >>> 0;
  return (): number => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

/**
 * Standard Stellar strkey alphabet (A-Z, 2-7).
 * The implementation in src/lib/stellar.ts only checks [A-Z0-9], so the fuzzer
 * must respect that contract to avoid false positives against the actual code.
 */
const STELLAR_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function randomFrom(rng: () => number, alphabet: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(rng() * alphabet.length)];
  }
  return out;
}

function randomInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

/**
 * Generates a valid-looking Stellar address (56 chars, prefix G or C).
 */
function generateValidAddress(rng: () => number, prefix: "G" | "C" = "G"): string {
  return prefix + randomFrom(rng, STELLAR_ALPHABET, 55);
}

describe("Validation Schema Fuzzing", () => {
  describe("isValidStellarAddress - fuzzing", () => {
    it("returns true for all randomly generated valid G addresses (1000 cases)", () => {
      const rng = createPrng(0xa1234567);
      for (let i = 0; i < 1000; i++) {
        const address = generateValidAddress(rng, "Geet");
        expect(isValidStellarAddress(address), `address #${i} = ${address}`).toBe(
          true,
        );
      }
    });

    it("returns true for all randomly generated valid C addresses (1000 cases)", () => {
      const rng = createPrng(0xb7654321);
      for (let i = 0; i < 1000; i++) {
        const address = generateValidAddress(rng, "C");
        expect(isValidStellarAddress(address), `address #${i} = ${address}`).toBe(
          true,
        );
      }
    });

    it("rejects addresses with wrong prefix (1000 cases)", () => {
      const rng = createPrng(0xc1234567);
      const badPrefixes = "ABDEFHIJKLMNOPQRSTUVWXYZ0123456789".split("");
      for (let i = 0; i < 1000; i++) {
        const prefix = badPrefixes[randomInt(rng, badPrefixes.length)];
        const address = prefix + randomFrom(rng, STELLAR_ALPHABET, 55);
        expect(isValidStellarAddress(address)).toBe(false);
      }
    });

    it("rejects addresses with wrong length (1000 cases)", () => {
      const rng = createPrng(0xd1234567);
      for (let i = 0; i < 1000; i++) {
        const prefix = rng() < 0.5 ? "G" : "C";
        // Pick a length that is not 56
        let len = randomInt(rng, 120);
        if (len === 56) len = 55;
        const address = prefix + randomFrom(rng, STELLAR_ALPHABET, Math.max(0, len - 1));
        expect(isValidStellarAddress(address)).toBe(false);
      }
    });

    it("rejects addresses containing lowercase letters (1000 cases)", () => {
      const rng = createPrng(0xe2345678);
      const lowercase = "abcdefghijklmnopqrstuvwxyz";
      for (let i = 0; i < 1000; i++) {
        const body = randomFrom(rng, STELLAR_ALPHABET, 54);
        const lower = lowercase[randomInt(rng, lowercase.length)];
        const address = "G" + body + lower;
        expect(isValidStellarAddress(address)).toBe(false);
      }
    });

    it("rejects addresses containing special characters (1000 cases)", () => {
      const rng = createPrng(0xf3456789);
      const special = "-!@#$%&*()+=/\\[]^`{}|;:'\",<>? \t\n\r";
      for (let i = 0; i < 1000; i++) {
        const body = randomFrom(rng, STELLAR_ALPHABET, 54);
        const bad = special[randomInt(rng, special.length)];
        const address = "G" + body + bad;
        expect(isValidStellarAddress(address)).toBe(false);
      }
    });

    it("rejects empty string and null-ish inputs", () => {
      expect(isValidStellarAddress("")).toBe(false);
      // @ts-expect-error -- testing runtime guard against non-string inputs
      expect(isValidStellarAddress(undefined as unknown as string)).toBe(false);
      // @ts-expect-error -- testing runtime guard against null
      expect(isValidStellarAddress(null as unknown as string)).toBe(false);
    });

    it("accepts addresses with surrounding whitespace (trim behavior)", () => {
      const rng = createPrng(0x12345678);
      for (let i = 0; i < 200; i++) {
        const address = generateValidAddress(rng, "G");
        expect(isValidStellarAddress(`  ${address}  `)).toBe(true);
        expect(isValidStellarAddress(`\n${address}\t`)).toBe(true);
      }
    });

    it("never returns true for random garbage strings (2000 cases)", () => {
      const rng = createPrng(0x98765432);
      const garbageAlphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !@#$%^&*()_+-={}[];:'\",.<>/?|~`\\\\";
      for (let i = 0; i < 2000; i++) {
        const len = randomInt(rng, 100);
        const garbage = randomFrom(rng, garbageAlphabet, len);
        // Only assert false when the garbage is not accidentally valid
        const looksValid =
          (garbage.startsWith("G") || garbage.startsWith("C")) &&
          garbage.length === 56 &&
          /^[A-Z0-9]+$/.test(garbage);
        if (!looksValid) {
          expect(isValidStellarAddress(garbage)).toBe(false);
        }
      }
    });

    it("has no false positives across a correlated fuzz sweep (5000 cases)", () => {
      const rng = createPrng(0xdeadbeef);
      let falsePositives = 0;
      for (let i = 0; i < 5000; i++) {
        // Build a string that is "almost" valid: correct prefix, near-correct length,
        // but with a single invalid character injected at a random position.
        const prefix = rng() < 0.5 ? "G" : "C";
        const len = 56 + (rng() < 0.5 ? 0 : randomInt(rng, 10) - 5);
        const bodyLen = Math.max(0, len - 1);
        const body = randomFrom(rng, BASE32_ALPHABET, bodyLen).split("");
        const invalidChars =
          "abcdefghijklmnopqrstuvwxyz!@#$%^&*()_+={}[];:'\",.<>/?|~` \\\n";
        const badChar = invalidChars[randomInt(rng, invalidChars.length)];
        const position = randomInt(rng, Math.max(1, body.length));
        if (body.length > 0) body[position % body.length] = badChar;
        const candidate = prefix + body.join("");
        if (isValidStellarAddress(candidate)) {
          falsePositives++;
        }
      }
      expect(falsePositives).toBe(0);
    });
  });

  describe("formatStellarAddress - fuzzing", () => {
    it("preserves empty and short inputs unchanged", () => {
      expect(formatStellarAddress("")).toBe("");
      expect(formatStellarAddress("GBCDEF123")).toBe("GBCDEF123");
      expect(formatStellarAddress("GBCDEF12")).toBe("GBCDEF12");
    });

    it("always returns a 11-character string for longer inputs (1000 cases)", () => {
      const rng = createPrng(0x6789abcd);
      for (let i = 0; i < 1000; i++) {
        const len = 10 + randomInt(rng, 100);
        const input = randomFrom(rng, STELLAR_ALPHABET, len);
        const formatted = formatStellarAddress(input);
        expect(formatted.length).toBe(11);
        expect(formatted.startsWith(input.slice(0, 4))).toBe(true);
        expect(formatted.slice(4, 7)).toBe("...");
        expect(formatted.endsWith(input.slice(-4))).toBe(true);
      }
    });

    it("formats valid Stellar addresses consistently (500 cases)", () => {
      const rng = createPrng(0xfedcba98);
      for (let i = 0; i < 500; i++) {
        const address = generateValidAddress(rng, "Geet");
        const formatted = formatStellarAddress(address);
        expect(formatted).toBe(`${address.slice(0, 4)}...${address.slice(-4)}`);
        // Round-trip sanity: formatted output must not be a valid address itself
        expect(isValidStellarAddress(formatted)).toBe(false);
      }
    });
  });

  describe("Error string matching", () => {
    it("matches the exact Freighter-not-installed error message", () => {
      // We only assert the exact string that the code throws when Freighter is missing.
      // This guarantees error messages don't drift away from the UI copy.
      const expected =
        "Freighter wallet extension is not detected. If on mobile, please use Albedo (Web Wallet) or Demo Account.";
      // Verify the module exports the function we expect and that its source contains
      // the exact message string -- this is a static contract check that fails if
      // the copy is edited without updating the test.
      expect(typeof connectFreighterWallet).toBe("function");
      const source = connectFreighterWallet.toString();
      expect(source.includes(expected)).toBe(true);
    });

    it("matches the exact Albedo popup-blocked error message", () => {
      const expected =
        "Albedo window was blocked by your browser popup blocker. Please allow popups for this site.";
      expect(typeof connectAlbedoWallet).toBe("function");
      const source = connectAlbedoWallet.toString();
      expect(source.includes(expected)).toBe(true);
    });

    it("matches the exact xBull-not-installed error message", () => {
      const expected =
        "xBull wallet extension is not installed. Please install xBull from https://xbull.app or use Albedo on mobile.";
      expect(typeof connectXbullWallet).toBe("function");
      const source = connectXbullWallet.toString();
      expect(source.includes(expected)).toBe(true);
    });

    it("throws the exact xBull message when xBull is unavailable", async () => {
      // Ensure global window has no xBull handle during this test.
      const globalWindow = globalThis as any;
      const previousXbull = globalWindow.xBullSDK;
      const previousXbullLower = globalWindow.xbull;
      delete globalWindow.xBullSDK;
      delete globalWindow.xbull;
      try {
        await expect(connectXbullWallet()).rejects.toThrow(
          "xBull wallet extension is not installed. Please install xBull from https://xbull.app or use Albedo on mobile.",
        );
      } finally {
        globalWindow.xBullSDK = previousXbull;
        globalWindow.xbull = previousXbullLower;
      }
    });
  });
});
