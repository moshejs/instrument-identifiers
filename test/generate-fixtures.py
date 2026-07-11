#!/usr/bin/env python3
"""Independent reference implementation of the five check-digit algorithms.

Generates test/fixtures.json for the vitest suite — written separately from
the TypeScript, straight from the published specs, as a transcription guard.
"""
import json
import random

random.seed(1452)

CUSIP_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ*@#"
CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ"


def val(ch):
    if ch.isdigit():
        return int(ch)
    if ch.isalpha():
        return ord(ch) - 55
    return {"*": 36, "@": 37, "#": 38}[ch]


def digit_sum(n):
    return sum(int(d) for d in str(n))


def cusip_cd(base8):
    total = 0
    for i, ch in enumerate(base8):
        v = val(ch)
        if i % 2 == 1:
            v *= 2
        total += digit_sum(v)
    return (10 - total % 10) % 10


def isin_cd(payload11):
    digits = "".join(str(val(c)) for c in payload11)
    total = 0
    for i, ch in enumerate(reversed(digits)):
        v = int(ch)
        if i % 2 == 0:
            v *= 2
        total += digit_sum(v)
    return (10 - total % 10) % 10


def sedol_cd(base6):
    weights = [1, 3, 1, 7, 3, 9]
    total = sum(val(c) * w for c, w in zip(base6, weights))
    return (10 - total % 10) % 10


def figi_cd(base11):
    total = 0
    for i, ch in enumerate(base11):
        v = val(ch)
        if i % 2 == 1:
            v *= 2
        total += digit_sum(v)
    return (10 - total % 10) % 10


def lei_check_digits(base18):
    expanded = "".join(str(val(c)) for c in base18) + "00"
    return f"{98 - int(expanded) % 97:02d}"


def lei_valid(lei20):
    return int("".join(str(val(c)) for c in lei20)) % 97 == 1


fixtures = {"cusip": [], "isin": [], "sedol": [], "figi": [], "lei": []}

for _ in range(60):
    base = "".join(random.choice("0123456789ABCDEFGHIJKLMNPQRSTUVWXYZ") for _ in range(8))
    fixtures["cusip"].append(base + str(cusip_cd(base)))
for _ in range(60):
    cc = "".join(random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(2))
    nsin = "".join(random.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(9))
    p = cc + nsin
    fixtures["isin"].append(p + str(isin_cd(p)))
for _ in range(60):
    base = "".join(random.choice("0123456789" + CONSONANTS) for _ in range(6))
    fixtures["sedol"].append(base + str(sedol_cd(base)))
for _ in range(60):
    while True:
        prefix = "".join(random.choice(CONSONANTS + "0123456789") for _ in range(2))
        if prefix not in {"BS", "BM", "GG", "GB", "GH", "KY", "VG"}:
            break
    body = "".join(random.choice(CONSONANTS + "0123456789") for _ in range(8))
    base = prefix + "G" + body
    fixtures["figi"].append(base + str(figi_cd(base)))
for _ in range(60):
    base = "".join(random.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(18))
    lei = base + lei_check_digits(base)
    assert lei_valid(lei)
    fixtures["lei"].append(lei)

# Real-world identifiers, verified against this reference implementation.
real = {
    "cusip": ["037833100", "91282CQQ7", "594918104", "38259P508"],
    "isin": ["US0378331005", "US5949181045", "GB0002634946", "DE000BAY0017"],
    "sedol": ["0263494", "B0YQ5W0"],
    "figi": ["BBG000B9XRY4", "BBG000BLNNH6"],
    "lei": ["HWUPKR0MPOU8FGXBT394", "5493001KJTIIGC8Y1R12"],
}
checks = {
    "cusip": lambda s: cusip_cd(s[:8]) == int(s[8]),
    "isin": lambda s: isin_cd(s[:11]) == int(s[11]),
    "sedol": lambda s: sedol_cd(s[:6]) == int(s[6]),
    "figi": lambda s: figi_cd(s[:11]) == int(s[11]),
    "lei": lei_valid,
}
for kind, values in real.items():
    for v in values:
        if not checks[kind](v):
            raise SystemExit(f"REAL FIXTURE FAILED reference check: {kind} {v}")
    fixtures[kind] = values + fixtures[kind]

with open("test/fixtures.json", "w") as f:
    json.dump(fixtures, f, indent=1)
print("wrote fixtures:", {k: len(v) for k, v in fixtures.items()})
