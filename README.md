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
| ISIN (12) | `isValidIsin` | `isinCheckDigit(payload11)` | `parseIsin` → country/NSIN | — |
| SEDOL (7) | `isValidSedol` | `sedolCheckDigit(base6)` | — | `sedolToIsin(sedol, cc?)` |
| FIGI (12) | `isValidFigi` | `figiCheckDigit(base11)` | `parseFigi` → prefix/id | — |
| LEI (20) | `isValidLei` | `leiCheckDigits(base18)` | — | — |

Plus **`identify(value)`** → every type the value validly matches. Inputs are case-insensitive; validators return booleans, everything else throws `RangeError` on malformed input. Format rules are enforced (FIGI's mandatory `G`, excluded country-like prefixes, SEDOL's no-vowels alphabet).

## Correctness

- Real-world anchors: Apple's CUSIP/ISIN/FIGI/LEI, a live US Treasury CUSIP, BAE's SEDOL→ISIN — each reproduced, not just validated.
- Cross-checked against an **independent Python reference implementation** ([`test/generate-fixtures.py`](test/generate-fixtures.py)): 300+ generated identifiers per run, every one validated and its check digit recomputed, plus corruption tests (every fixture with a damaged check digit must fail).

## Related

Part of a small fixed-income toolkit: [`32nds`](https://github.com/moshejs/32nds) · [`day-count`](https://github.com/moshejs/day-count) · [`accrued-interest`](https://github.com/moshejs/accrued-interest) · [`sifma-holidays`](https://github.com/moshejs/sifma-holidays) · [`treasurydirect`](https://github.com/moshejs/treasurydirect) · [`tbill`](https://github.com/moshejs/tbill) · [`newyorkfed`](https://github.com/moshejs/newyorkfed).

## Author

Built by **[Moshe Malka](https://moshemalka.com)** — engineering leader in New York City. Studio work at [Quentin.Code](https://www.quentin.software/).

MIT © Moshe Malka
