/**
 * instrument-identifiers — securities identifier math in one package.
 *
 * Validation, parsing, and check-digit computation for CUSIP, ISIN, SEDOL,
 * FIGI, and LEI, plus CUSIP→ISIN and SEDOL→ISIN conversion. Strictly the
 * free algorithm/format layer (published check-digit specs) — no licensed
 * identifier database content.
 */

export type IdentifierType = "CUSIP" | "ISIN" | "SEDOL" | "FIGI" | "LEI";

function norm(value: string): string {
  return value.trim().toUpperCase();
}

/** 0-9 → 0-9, A-Z → 10-35; CUSIP additionally allows * @ # (36-38). */
function charValue(ch: string, cusipSpecials = false): number {
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 90) return code - 55;
  if (cusipSpecials) {
    if (ch === "*") return 36;
    if (ch === "@") return 37;
    if (ch === "#") return 38;
  }
  return -1;
}

function digitSum(n: number): number {
  let s = 0;
  for (let v = n; v > 0; v = Math.floor(v / 10)) s += v % 10;
  return s;
}

// ---------------------------------------------------------------------------
// CUSIP — 9 characters, mod-10 "double-add-double" check digit
// ---------------------------------------------------------------------------

const CUSIP_BODY_RE = /^[0-9A-Z*@#]{8}$/;

/** Check digit for the first 8 CUSIP characters. */
export function cusipCheckDigit(base: string): number {
  const b = norm(base);
  if (!CUSIP_BODY_RE.test(b)) {
    throw new RangeError(`CUSIP base must be 8 characters of 0-9 A-Z * @ #, got "${base}"`);
  }
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let v = charValue(b[i]!, true);
    if (i % 2 === 1) v *= 2;
    sum += digitSum(v);
  }
  return (10 - (sum % 10)) % 10;
}

/** True for a structurally valid 9-character CUSIP with a correct check digit. */
export function isValidCusip(value: string): boolean {
  const v = norm(value);
  if (!/^[0-9A-Z*@#]{8}[0-9]$/.test(v)) return false;
  return cusipCheckDigit(v.slice(0, 8)) === Number(v[8]);
}

export interface ParsedCusip {
  /** 6-character issuer number. */
  issuer: string;
  /** 2-character issue number. */
  issue: string;
  checkDigit: number;
}

/** Split a valid CUSIP into issuer/issue/check digit. Throws on invalid input. */
export function parseCusip(value: string): ParsedCusip {
  const v = norm(value);
  if (!isValidCusip(v)) throw new RangeError(`Invalid CUSIP: "${value}"`);
  return { issuer: v.slice(0, 6), issue: v.slice(6, 8), checkDigit: Number(v[8]) };
}

// ---------------------------------------------------------------------------
// ISIN — 12 characters, ISO 6166 (Luhn over letter-expanded digits)
// ---------------------------------------------------------------------------

/** Luhn sum over an alphanumeric payload, doubling from the rightmost digit. */
function isinLuhnSum(payload: string): number {
  const digits: number[] = [];
  for (const ch of payload) {
    const v = charValue(ch);
    if (v < 0) throw new RangeError(`Invalid ISIN character "${ch}"`);
    if (v >= 10) {
      digits.push(Math.floor(v / 10), v % 10);
    } else {
      digits.push(v);
    }
  }
  let sum = 0;
  // i counts from the RIGHT end of the digit string; even i is doubled.
  for (let i = 0; i < digits.length; i++) {
    let v = digits[digits.length - 1 - i]!;
    if (i % 2 === 0) v *= 2;
    sum += digitSum(v);
  }
  return sum;
}

/** Check digit for an 11-character ISIN payload (country code + NSIN). */
export function isinCheckDigit(payload: string): number {
  const p = norm(payload);
  if (!/^[A-Z]{2}[0-9A-Z]{9}$/.test(p)) {
    throw new RangeError(`ISIN payload must be 2 letters + 9 alphanumerics, got "${payload}"`);
  }
  return (10 - (isinLuhnSum(p) % 10)) % 10;
}

// ISO 3166-1 alpha-2 codes (including the withdrawn AN and CS, which still
// prefix live ISINs), plus prefixes ISO 6166 numbering agencies use that are
// not countries: EU, QS, QT, XA, XB, XC, XD, XF, XK, XS. (Same set as
// python-stdnum 2.2.)
const ISIN_PREFIXES = new Set(
  (
    "AD AE AF AG AI AL AM AN AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI " +
    "BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO " +
    "CR CS CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM " +
    "FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR " +
    "HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW " +
    "KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO " +
    "MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA " +
    "PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG " +
    "SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN " +
    "TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM " +
    "ZW" +
    " EU QS QT XA XB XC XD XF XK XS"
  ).split(" "),
);

export interface IsinOptions {
  /**
   * Also require the first two letters to be an ISO 3166-1 country code or a
   * recognised ISIN-only prefix (XS, EU, …). Default false: format and check
   * digit only.
   */
  checkCountry?: boolean;
}

/** True when `code` is an ISO 3166-1 alpha-2 code or an ISIN-only prefix (XS, EU, …). */
export function isIsinCountryCode(code: string): boolean {
  return ISIN_PREFIXES.has(norm(code));
}

/**
 * True for a structurally valid 12-character ISIN with a correct check digit.
 * The country prefix is only checked against ISO 3166 with
 * `{ checkCountry: true }`.
 */
export function isValidIsin(value: string, opts: IsinOptions = {}): boolean {
  const v = norm(value);
  if (!/^[A-Z]{2}[0-9A-Z]{9}[0-9]$/.test(v)) return false;
  if (opts.checkCountry && !ISIN_PREFIXES.has(v.slice(0, 2))) return false;
  return isinCheckDigit(v.slice(0, 11)) === Number(v[11]);
}

export interface ParsedIsin {
  /** ISO 3166 country code (or XS etc. for international). */
  countryCode: string;
  /** 9-character national securities identifying number. */
  nsin: string;
  checkDigit: number;
}

/** Split a valid ISIN into country/NSIN/check digit. Throws on invalid input. */
export function parseIsin(value: string): ParsedIsin {
  const v = norm(value);
  if (!isValidIsin(v)) throw new RangeError(`Invalid ISIN: "${value}"`);
  return { countryCode: v.slice(0, 2), nsin: v.slice(2, 11), checkDigit: Number(v[11]) };
}

/**
 * Build the ISIN for a CUSIP: country code + CUSIP + recomputed check digit.
 * `cusipToIsin("037833100")` → `"US0378331005"`.
 */
export function cusipToIsin(cusip: string, countryCode = "US"): string {
  const c = norm(cusip);
  if (!isValidCusip(c)) throw new RangeError(`Invalid CUSIP: "${cusip}"`);
  const cc = norm(countryCode);
  if (!/^[A-Z]{2}$/.test(cc)) throw new RangeError(`Invalid country code: "${countryCode}"`);
  const payload = cc + c;
  return payload + isinCheckDigit(payload);
}

/**
 * Build the ISIN for a SEDOL: country code + "00" + SEDOL + check digit.
 * Defaults to GB.
 */
export function sedolToIsin(sedol: string, countryCode = "GB"): string {
  const s = norm(sedol);
  if (!isValidSedol(s)) throw new RangeError(`Invalid SEDOL: "${sedol}"`);
  const cc = norm(countryCode);
  if (!/^[A-Z]{2}$/.test(cc)) throw new RangeError(`Invalid country code: "${countryCode}"`);
  const payload = `${cc}00${s}`;
  return payload + isinCheckDigit(payload);
}

// ---------------------------------------------------------------------------
// SEDOL — 7 characters, weighted mod-10 (weights 1,3,1,7,3,9)
// ---------------------------------------------------------------------------

const SEDOL_WEIGHTS = [1, 3, 1, 7, 3, 9];
// SEDOLs use digits and consonants only (no vowels).
const SEDOL_BODY_RE = /^[0-9BCDFGHJKLMNPQRSTVWXYZ]{6}$/;

/** Check digit for the first 6 SEDOL characters. */
export function sedolCheckDigit(base: string): number {
  const b = norm(base);
  if (!SEDOL_BODY_RE.test(b)) {
    throw new RangeError(
      `SEDOL base must be 6 characters of digits/consonants (no vowels), got "${base}"`,
    );
  }
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    sum += charValue(b[i]!) * SEDOL_WEIGHTS[i]!;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * True for a structurally valid 7-character SEDOL with a correct check digit.
 * SEDOLs are either all-numeric (issued before 2004) or begin with a letter
 * (issued since, starting at B000009); a leading digit followed by letters is
 * not a valid SEDOL.
 */
export function isValidSedol(value: string): boolean {
  const v = norm(value);
  if (!/^[0-9BCDFGHJKLMNPQRSTVWXYZ]{6}[0-9]$/.test(v)) return false;
  if (/^[0-9]/.test(v) && !/^[0-9]{7}$/.test(v)) return false;
  return sedolCheckDigit(v.slice(0, 6)) === Number(v[6]);
}

// ---------------------------------------------------------------------------
// FIGI — 12 characters per the OMG spec, mod-10 double-add-double
// ---------------------------------------------------------------------------

// Consonants + digits only; the two-character provider prefix is consonants
// only, and the third character is always G.
const FIGI_CHAR_RE = /^[0-9BCDFGHJKLMNPQRSTVWXYZ]+$/;
const FIGI_PREFIX_RE = /^[BCDFGHJKLMNPQRSTVWXYZ]{2}$/;
// Prefixes excluded by the OMG spec to avoid ISIN country-code confusion
// (GH and KY were added in a later revision; see OMG issue FIGI-6).
const FIGI_EXCLUDED_PREFIXES = new Set(["BS", "BM", "GG", "GB", "GH", "KY", "VG"]);

/** Check digit for the first 11 FIGI characters. */
export function figiCheckDigit(base: string): number {
  const b = norm(base);
  if (b.length !== 11 || !FIGI_CHAR_RE.test(b)) {
    throw new RangeError(
      `FIGI base must be 11 characters of digits/consonants (no vowels), got "${base}"`,
    );
  }
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    let v = charValue(b[i]!);
    if (i % 2 === 1) v *= 2; // even 1-indexed positions
    sum += digitSum(v);
  }
  return (10 - (sum % 10)) % 10;
}

/** True for a structurally valid 12-character FIGI with a correct check digit. */
export function isValidFigi(value: string): boolean {
  const v = norm(value);
  if (v.length !== 12 || !FIGI_CHAR_RE.test(v.slice(0, 11)) || !/[0-9]/.test(v[11]!)) return false;
  if (v[2] !== "G") return false;
  if (!FIGI_PREFIX_RE.test(v.slice(0, 2)) || FIGI_EXCLUDED_PREFIXES.has(v.slice(0, 2))) return false;
  return figiCheckDigit(v.slice(0, 11)) === Number(v[11]);
}

export interface ParsedFigi {
  /** 2-character prefix (e.g. "BB"). */
  prefix: string;
  /** 8-character identifier portion after the mandatory "G". */
  id: string;
  checkDigit: number;
}

/** Split a valid FIGI into prefix/id/check digit. Throws on invalid input. */
export function parseFigi(value: string): ParsedFigi {
  const v = norm(value);
  if (!isValidFigi(v)) throw new RangeError(`Invalid FIGI: "${value}"`);
  return { prefix: v.slice(0, 2), id: v.slice(3, 11), checkDigit: Number(v[11]) };
}

// ---------------------------------------------------------------------------
// LEI — 20 characters, ISO 7064 MOD 97-10
// ---------------------------------------------------------------------------

/** Streaming mod-97 over the letter-expanded digit string. */
function mod97(expanded: string): number {
  let acc = 0;
  for (const ch of expanded) {
    acc = (acc * 10 + (ch.charCodeAt(0) - 48)) % 97;
  }
  return acc;
}

function leiExpand(value: string): string {
  let out = "";
  for (const ch of value) {
    const v = charValue(ch);
    if (v < 0) throw new RangeError(`Invalid LEI character "${ch}"`);
    out += String(v);
  }
  return out;
}

/** The two ISO 7064 check digits for an 18-character LEI base, as "NN". */
export function leiCheckDigits(base: string): string {
  const b = norm(base);
  if (!/^[0-9A-Z]{18}$/.test(b)) {
    throw new RangeError(`LEI base must be 18 alphanumeric characters, got "${base}"`);
  }
  const check = 98 - mod97(leiExpand(b) + "00");
  return String(check).padStart(2, "0");
}

/**
 * True for a structurally valid 20-character LEI: ISO 7064 MOD 97-10 remainder
 * of 1, with check digits in the range 02–98 that the algorithm can produce
 * (so a base ending in "00"/"01" whose remainder is also 1 is rejected).
 */
export function isValidLei(value: string): boolean {
  const v = norm(value);
  if (!/^[0-9A-Z]{18}[0-9]{2}$/.test(v)) return false;
  const check = Number(v.slice(18));
  if (check < 2 || check > 98) return false;
  return mod97(leiExpand(v)) === 1;
}

// ---------------------------------------------------------------------------
// identify
// ---------------------------------------------------------------------------

/**
 * Every identifier type the value validly matches (format AND check digit).
 * A 9-character string could in principle be only a CUSIP; a 12-character
 * string could match both ISIN and FIGI formats, so an array is returned.
 */
export function identify(value: string): IdentifierType[] {
  const out: IdentifierType[] = [];
  if (isValidCusip(value)) out.push("CUSIP");
  if (isValidIsin(value)) out.push("ISIN");
  if (isValidSedol(value)) out.push("SEDOL");
  if (isValidFigi(value)) out.push("FIGI");
  if (isValidLei(value)) out.push("LEI");
  return out;
}
