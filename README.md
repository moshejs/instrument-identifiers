# instrument-identifiers

Securities identifier math in one package — **CUSIP**, **ISIN**, **SEDOL**, **FIGI**, and **LEI**: validation, parsing, check-digit computation, and **CUSIP→ISIN / SEDOL→ISIN conversion**. Zero dependencies.

```
npm install instrument-identifiers
```

## Why

Every trading, settlement, or reference-data system juggles at least three identifier schemes, and each has its own check-digit algorithm (CUSIP's mod-10 double-add-double, ISIN's ISO 6166 Luhn, SEDOL's 1-3-1-7-3-9 weights, FIGI's OMG spec, LEI's ISO 7064 MOD 97-10). npm had them scattered across single-purpose validators — several dead, none doing conversion. This package is the whole set, strictly the free algorithm layer: no licensed identifier database content.

```ts
import { isValidCusip, cusipToIsin, parseIsin, identify } from "instrument-identifiers";

isValidCusip("91282CQQ7");     // true — a live Treasury note
cusipToIsin("037833100");      // "US0378331005" — Apple, real ISIN reproduced
parseIsin("US0378331005");     // { countryCode: "US", nsin: "037833100", checkDigit: 5 }
identify("BBG000B9XRY4");      // ["FIGI"]
```

## API

Per identifier — `isValidX(value)`, `xCheckDigit(base)`, and where the structure is meaningful, `parseX(value)`:

| Identifier | Validate | Check digit | Parse | Convert |
| --- | --- | --- | --- | --- |
| CUSIP (9) | `isValidCusip` | `cusipCheckDigit(base8)` | `parseCusip` → issuer/issue | `cusipToIsin(cusip, cc?)` |
| ISIN (12) | `isValidIsin(v, { checkCountry? })` | `isinCheckDigit(payload11)` | `parseIsin` → country/NSIN | — |
| SEDOL (7) | `isValidSedol` | `sedolCheckDigit(base6)` | — | `sedolToIsin(sedol, cc?)` |
| FIGI (12) | `isValidFigi` | `figiCheckDigit(base11)` | `parseFigi` → prefix/id | — |
| LEI (20) | `isValidLei` | `leiCheckDigits(base18)` | — | — |

Plus **`identify(value)`** → every type the value validly matches, and **`isIsinCountryCode(cc)`**. Inputs are case-insensitive and trimmed; validators return booleans, everything else throws `RangeError` on malformed input.

Format rules enforced by the validators:

- **FIGI**: a two-consonant provider prefix, excluding BS, BM, GG, GB, GH, KY and VG; `G` in position 3; no vowels.
- **SEDOL**: no vowels. A SEDOL is either all-numeric (pre-2004) or starts with a letter.
- **LEI**: two numeric check digits in the range ISO 7064 can produce (02–98).
- **ISIN**: by default only the format and check digit are verified. Pass `{ checkCountry: true }` to also require an ISO 3166-1 alpha-2 code, or an ISIN-only prefix such as XS or EU.
- **CUSIP**: `*`, `@` and `#` are accepted (as in PPNs).

The check-digit functions (`xCheckDigit`) only check the character set of the base, not these structural rules.

## Correctness

- Real-world anchors: Apple's CUSIP/ISIN/FIGI/LEI, a live US Treasury CUSIP, BAE's SEDOL→ISIN — each reproduced, not just validated. (The LEIs were confirmed with GLEIF and the Treasury CUSIP with TreasuryDirect.)
- Cross-checked against **[python-stdnum](https://pypi.org/project/python-stdnum/)** ([`test/generate-fixtures.py`](test/generate-fixtures.py)): 500+ generated identifiers have their check digits recomputed, and 5,200 valid, random and corrupted strings are classified exactly as stdnum does. An audit run of 260,000 strings also agreed. There are three deliberate deviations where this package follows the primary spec: FIGI also excludes the GH and KY prefixes (OMG issue FIGI-6), LEI check digits must be numeric and in 02–98, and the ISIN country check is opt-in.

## Related

Part of a small fixed-income toolkit: [`32nds`](https://github.com/moshejs/32nds) · [`day-count`](https://github.com/moshejs/day-count) · [`accrued-interest`](https://github.com/moshejs/accrued-interest) · [`sifma-holidays`](https://github.com/moshejs/sifma-holidays) · [`treasurydirect`](https://github.com/moshejs/treasurydirect) · [`tbill`](https://github.com/moshejs/tbill) · [`newyorkfed`](https://github.com/moshejs/newyorkfed).

## Author

Built by **[Moshe Malka](https://moshemalka.com)** — engineering leader in New York City. Studio work at [Quentin.Code](https://www.quentin.software/).

MIT © Moshe Malka
