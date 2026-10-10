#!/usr/bin/env python3
"""Reference fixtures for instrument-identifiers, from python-stdnum.

Valid identifiers are generated with the correct structure and stdnum's check
digit functions (stdnum.cusip, stdnum.isin, stdnum.gb.sedol, stdnum.figi,
stdnum.iso7064.mod_97_10). `verdicts` holds random, valid, and single-character
corrupted strings with stdnum's is_valid() verdict, with three documented
deviations where this package follows the primary spec instead:

- FIGI: stdnum excludes BS/BM/GG/GB/VG prefixes; the OMG spec also excludes GH
  and KY (OMG issue FIGI-6), so those are marked invalid here.
- LEI: stdnum accepts letters in the two check positions; ISO 17442 check
  digits are numeric (02-98), so those are marked invalid here.
- ISIN: stdnum checks the country prefix; both verdicts are stored
  (`valid` = checksum + format only, `validCountry` = stdnum's).

Usage: python -I test/generate-fixtures.py   (needs python-stdnum)
Writes test/fixtures.json.
"""
import json
import random

import stdnum
from stdnum import cusip, figi, isin, lei
from stdnum.gb import sedol
from stdnum.iso7064 import mod_97_10

random.seed(1452)

AN = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
DIGITS = "0123456789"
CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ"
FIGI_EXCLUDED = {"BS", "BM", "GG", "GB", "GH", "KY", "VG"}


def rs(alphabet, n):
    return "".join(random.choice(alphabet) for _ in range(n))


def corrupt(s):
    i = random.randrange(len(s))
    return s[:i] + random.choice(AN + "*@#") + s[i + 1:]


fixtures = {"cusip": [], "isin": [], "sedol": [], "figi": [], "lei": []}
for _ in range(100):
    b = rs(AN, 6) + rs(AN + "*@#", 2)
    fixtures["cusip"].append(b + cusip.calc_check_digit(b))
    p = random.choice(["US", "GB", "DE", "FR", "JP", "XS", "CH", "CA", "AU", "KY"]) + rs(AN, 9)
    fixtures["isin"].append(p + isin.calc_check_digit(p))
    b = rs(DIGITS, 6) if random.random() < 0.4 else random.choice(CONSONANTS) + rs(DIGITS + CONSONANTS, 5)
    fixtures["sedol"].append(b + sedol.calc_check_digit(b))
    while True:
        prefix = rs(CONSONANTS, 2)
        if prefix not in FIGI_EXCLUDED:
            break
    b = prefix + "G" + rs(CONSONANTS + DIGITS, 8)
    fixtures["figi"].append(b + figi.calc_check_digit(b))
    b = rs(AN, 18)
    fixtures["lei"].append(b + mod_97_10.calc_check_digits(b))

for kind, check in [("cusip", cusip.is_valid), ("isin", isin.is_valid), ("sedol", sedol.is_valid),
                    ("figi", figi.is_valid), ("lei", lei.is_valid)]:
    for v in fixtures[kind]:
        assert check(v), (kind, v)

# Real-world identifiers (confirmed against GLEIF / TreasuryDirect / issuer data).
real = {
    "cusip": ["037833100", "91282CQQ7", "594918104", "38259P508"],
    "isin": ["US0378331005", "US5949181045", "GB0002634946", "DE000BAY0017"],
    "sedol": ["0263494", "B0YQ5W0"],
    "figi": ["BBG000B9XRY4", "BBG000BLNNH6"],
    "lei": ["HWUPKR0MPOU8FGXBT394", "5493001KJTIIGC8Y1R12"],
}
for kind, values in real.items():
    fixtures[kind] = values + fixtures[kind]

verdicts = {k: [] for k in fixtures}
for _ in range(400):
    b = rs(AN + "*@#", 8)
    c = b + cusip.calc_check_digit(b)
    for v in [c, corrupt(c), b + rs(DIGITS, 1)]:
        verdicts["cusip"].append({"value": v, "valid": cusip.is_valid(v)})

    p = rs(AN[10:], 2) + rs(AN, 9)
    i_ = p + isin.calc_check_digit(p)
    for v in [i_, corrupt(i_), random.choice(["US", "GB", "XS"]) + rs(AN, 9) + rs(DIGITS, 1)]:
        fmt = (len(v) == 12 and v[:2].isalpha() and all(ch in AN for ch in v) and v[11] in DIGITS
               and isin.calc_check_digit(v[:11]) == v[11])
        verdicts["isin"].append({"value": v, "valid": bool(fmt), "validCountry": isin.is_valid(v)})

    b = random.choice([rs(DIGITS, 6), random.choice(CONSONANTS) + rs(DIGITS + CONSONANTS, 5),
                       rs(DIGITS + CONSONANTS, 6)])
    s_ = b + sedol.calc_check_digit(b)
    for v in [s_, corrupt(s_)]:
        verdicts["sedol"].append({"value": v, "valid": sedol.is_valid(v)})

    b = random.choice([rs(CONSONANTS, 2), rs(CONSONANTS + DIGITS, 2), random.choice(sorted(FIGI_EXCLUDED))]) + \
        random.choice(["G", "G", "G", rs(CONSONANTS, 1)]) + rs(CONSONANTS + DIGITS, 8)
    f_ = b + figi.calc_check_digit(b)
    for v in [f_, corrupt(f_)]:
        verdicts["figi"].append({"value": v, "valid": figi.is_valid(v) and v[:2] not in FIGI_EXCLUDED})

    b = rs(AN, 18)
    l_ = b + mod_97_10.calc_check_digits(b)
    for v in [l_, corrupt(l_), b + rs(DIGITS, 2)]:
        verdicts["lei"].append({"value": v, "valid": lei.is_valid(v) and all(ch in DIGITS for ch in v[18:])})

fixtures["verdicts"] = verdicts
fixtures["_meta"] = {"generator": "test/generate-fixtures.py", "python-stdnum": stdnum.__version__}
with open("test/fixtures.json", "w") as f:
    json.dump(fixtures, f, indent=1)
print("wrote fixtures:", {k: len(v) for k, v in fixtures.items() if k not in ("verdicts", "_meta")},
      {k: len(v) for k, v in verdicts.items()})
