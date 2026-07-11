import { describe, expect, it } from "vitest";
import {
  cusipCheckDigit,
  cusipToIsin,
  figiCheckDigit,
  identify,
  isValidCusip,
  isValidFigi,
  isValidIsin,
  isValidLei,
  isValidSedol,
  isinCheckDigit,
  leiCheckDigits,
  parseCusip,
  parseFigi,
  parseIsin,
  sedolCheckDigit,
  sedolToIsin,
} from "../src/index.js";
import fixtures from "./fixtures.json";

describe("real-world identifiers", () => {
  it("validates famous CUSIPs (Apple, a live Treasury note, Microsoft, GameStop)", () => {
    expect(isValidCusip("037833100")).toBe(true);
    expect(isValidCusip("91282CQQ7")).toBe(true); // 4.375% Treasury note
    expect(isValidCusip("594918104")).toBe(true);
    expect(isValidCusip("38259P508")).toBe(true);
    expect(isValidCusip("037833101")).toBe(false); // corrupted check digit
  });

  it("validates famous ISINs and rejects corruption", () => {
    expect(isValidIsin("US0378331005")).toBe(true);
    expect(isValidIsin("GB0002634946")).toBe(true); // BAE Systems
    expect(isValidIsin("DE000BAY0017")).toBe(true); // Bayer
    expect(isValidIsin("US0378331004")).toBe(false);
    expect(isValidIsin("us0378331005")).toBe(true); // case-insensitive
  });

  it("validates SEDOLs, FIGIs, LEIs", () => {
    expect(isValidSedol("0263494")).toBe(true); // BAE Systems
    expect(isValidSedol("B0YQ5W0")).toBe(true);
    expect(isValidSedol("0263495")).toBe(false);
    expect(isValidFigi("BBG000B9XRY4")).toBe(true); // Apple US equity
    expect(isValidFigi("BBG000B9XRY5")).toBe(false);
    expect(isValidLei("HWUPKR0MPOU8FGXBT394")).toBe(true); // Apple Inc.
    expect(isValidLei("5493001KJTIIGC8Y1R12")).toBe(true);
    expect(isValidLei("HWUPKR0MPOU8FGXBT395")).toBe(false);
  });
});

describe("conversions", () => {
  it("CUSIP → ISIN reproduces the real Apple ISIN", () => {
    expect(cusipToIsin("037833100")).toBe("US0378331005");
    expect(cusipToIsin("594918104")).toBe("US5949181045");
  });

  it("SEDOL → ISIN reproduces the real BAE ISIN", () => {
    expect(sedolToIsin("0263494")).toBe("GB0002634946");
  });

  it("round-trips: converted ISINs validate and parse back", () => {
    const isin = cusipToIsin("91282CQQ7");
    expect(isValidIsin(isin)).toBe(true);
    expect(parseIsin(isin).nsin).toBe("91282CQQ7");
    expect(parseIsin(isin).countryCode).toBe("US");
  });

  it("rejects invalid inputs to conversion", () => {
    expect(() => cusipToIsin("037833101")).toThrow(RangeError);
    expect(() => cusipToIsin("037833100", "USA")).toThrow(RangeError);
    expect(() => sedolToIsin("0263495")).toThrow(RangeError);
  });
});

describe("parsing", () => {
  it("splits identifiers into their documented parts", () => {
    expect(parseCusip("037833100")).toEqual({ issuer: "037833", issue: "10", checkDigit: 0 });
    expect(parseIsin("US0378331005")).toEqual({
      countryCode: "US",
      nsin: "037833100",
      checkDigit: 5,
    });
    expect(parseFigi("BBG000B9XRY4")).toEqual({ prefix: "BB", id: "000B9XRY", checkDigit: 4 });
  });

  it("throws on invalid input", () => {
    expect(() => parseCusip("bogus")).toThrow(RangeError);
    expect(() => parseIsin("US03783310")).toThrow(RangeError);
    expect(() => parseFigi("AAG000B9XRY4")).toThrow(RangeError); // vowel prefix
  });
});

describe("format rules", () => {
  it("FIGI requires G in position 3 and rejects excluded prefixes", () => {
    expect(isValidFigi("BBX000B9XRY4")).toBe(false); // no G
    // GB is an excluded prefix even with a correct check digit
    const base = "GBG000B9XRY";
    expect(isValidFigi(base + figiCheckDigit(base))).toBe(false);
  });

  it("SEDOL rejects vowels", () => {
    expect(isValidSedol("0A63494")).toBe(false);
    expect(() => sedolCheckDigit("0A6349")).toThrow(RangeError);
  });

  it("check-digit functions validate their input shape", () => {
    expect(() => cusipCheckDigit("0378331")).toThrow(RangeError);
    expect(() => isinCheckDigit("0S037833100")).toThrow(RangeError); // digit country
    expect(() => figiCheckDigit("BBG000B9XR")).toThrow(RangeError);
    expect(() => leiCheckDigits("SHORT")).toThrow(RangeError);
  });
});

describe("identify", () => {
  it("classifies by length + checksum", () => {
    expect(identify("037833100")).toEqual(["CUSIP"]);
    expect(identify("US0378331005")).toEqual(["ISIN"]);
    expect(identify("BBG000B9XRY4")).toEqual(["FIGI"]);
    expect(identify("0263494")).toEqual(["SEDOL"]);
    expect(identify("HWUPKR0MPOU8FGXBT394")).toEqual(["LEI"]);
    expect(identify("hello")).toEqual([]);
  });
});

describe("cross-check against independent Python reference", () => {
  it(`validates all ${fixtures.cusip.length} CUSIP fixtures and their corruptions`, () => {
    for (const f of fixtures.cusip) {
      expect(isValidCusip(f), f).toBe(true);
      const bad = f.slice(0, 8) + String((Number(f[8]) + 1) % 10);
      expect(isValidCusip(bad), bad).toBe(false);
    }
  });

  it("validates all ISIN fixtures and their corruptions", () => {
    for (const f of fixtures.isin) {
      expect(isValidIsin(f), f).toBe(true);
      expect(isValidIsin(f.slice(0, 11) + String((Number(f[11]) + 3) % 10))).toBe(false);
    }
  });

  it("validates all SEDOL fixtures and their corruptions", () => {
    for (const f of fixtures.sedol) {
      expect(isValidSedol(f), f).toBe(true);
      expect(isValidSedol(f.slice(0, 6) + String((Number(f[6]) + 1) % 10))).toBe(false);
    }
  });

  it("validates all FIGI fixtures and their corruptions", () => {
    for (const f of fixtures.figi) {
      expect(isValidFigi(f), f).toBe(true);
      expect(isValidFigi(f.slice(0, 11) + String((Number(f[11]) + 7) % 10))).toBe(false);
    }
  });

  it("validates all LEI fixtures and their corruptions", () => {
    for (const f of fixtures.lei) {
      expect(isValidLei(f), f).toBe(true);
      const bad = f.slice(0, 18) + String((Number(f.slice(18)) + 11) % 100).padStart(2, "0");
      expect(isValidLei(bad), bad).toBe(false);
    }
  });

  it("recomputes every fixture's check digit(s) from its base", () => {
    for (const f of fixtures.cusip) expect(cusipCheckDigit(f.slice(0, 8))).toBe(Number(f[8]));
    for (const f of fixtures.isin) expect(isinCheckDigit(f.slice(0, 11))).toBe(Number(f[11]));
    for (const f of fixtures.sedol) expect(sedolCheckDigit(f.slice(0, 6))).toBe(Number(f[6]));
    for (const f of fixtures.figi) expect(figiCheckDigit(f.slice(0, 11))).toBe(Number(f[11]));
    for (const f of fixtures.lei) expect(leiCheckDigits(f.slice(0, 18))).toBe(f.slice(18));
  });
});
