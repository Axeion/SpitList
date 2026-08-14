---
title: Commission numbers
summary: How to read a pre-1979 Spitfire chassis tag, and where to find it.
order: 10
updated: 2026-08-14
sources:
  - label: Triumph Spitfire identification — European Spitfire buyers guide
    url: http://triumphspitfire.nl/identification.html
  - label: Spitfire & GT6 Information Warehouse — models and options
    url: https://triumphspitfire.com/reference-pages/spitfire-gt6-models-and-options/
  - label: Amicale Spitfire Club — Triumph serial number tables
    url: http://www.amicalespitfire.org/technique/tableaux/serial.php
---

Every Spitfire built before October 1979 carries a **commission number** — Triumph's
term for what most people call the chassis number. It is the one identifier this
registry is organised around, because it is the number that stays with the car.

## Where to find it

On non-US cars, the commission number is on an aluminium plate riveted to the
**left-hand bulkhead panel**, under the bonnet. On US-market cars it is usually on
a plate attached **inside the left-hand doorframe** instead.

If the plate is gone, the car can still be listed here — but it moves to the
archive rather than counting as a documented survivor, because there is no longer
a way to tie the car to the number.

## Anatomy of the number

A commission number is three parts run together:

```
FH 45231 L
│  │     │
│  │     └── suffix   — build variations
│  └──────── serial   — sequential within the series
└─────────── prefix   — which model and market
```

Spacing and punctuation are not meaningful. `FH45231L`, `FH 45231 L` and
`fh-45231-l` are the same car, and the registry treats them as such — it stores
what you typed and searches on a normalised form.

### Prefixes

| Prefix | Model | Market |
| --- | --- | --- |
| `FC` | Mk1, then Mk2 | Worldwide |
| `FD` | Mk3 | Worldwide |
| `FDU` | Mk3 | United States |
| `7FD` | Mk3 | Canada (some cars) |
| `FH` | MkIV, then 1500 | Worldwide, then rest of world |
| `FK` | MkIV, 1,296cc | North America |
| `FL` | MkIV | Sweden |
| `FM` | 1500 | North America |
| `1FM` | 1500 | North America, assembled at Senneffe, Belgium |

Two of these span more than one model, which catches people out. `FC` runs
straight through from the Mk1 into the Mk2 rather than restarting, and `FH` opens
with the MkIV and keeps going when the 1500 arrives. A prefix on its own does not
tell you which model you have.

The North American split is the other thing worth knowing. US cars took the 1500
engine in 1973, two years before the rest of the world, so a 1973–74 `FM` car is
a MkIV with a 1500 badge and a 1500 engine while a `FH` car of the same date is
still a 1,296cc MkIV. `FK` covers the US MkIVs that kept the smaller engine.

`7FD` and `1FM` come from a single compilation, and the source itself hedges on
how widely `7FD` was used.

### Suffixes

| Suffix | Meaning |
| --- | --- |
| `L` | Left-hand drive |
| `O` | Overdrive fitted |
| `LO` | Both |
| `U` | United States specification |
| `UC` | United States, California specification |

No suffix means right-hand drive. One of our two sources reads `L` the other way
round — as right-hand drive — and is outvoted three to one; we have kept the note
rather than quietly dropping it, because it is the kind of disagreement that
otherwise gets copied from site to site until it looks like a fact.

`U` and `UC` come from one source only. Other trailing letters do appear on
surviving cars, and this registry does not document them all. If you have a
suffix that isn't listed here, submit the car anyway and put the number in the
notes; that is how the gap gets filled.

## After October 1979

Triumph switched to the international VIN standard partway through the 1979 model
year. Cars built from that point have no commission number at all — see
[VIN numbers](/reference/vin).

## Serial ranges

| Model | Range | Standing |
| --- | --- | --- |
| Mk1 | `FC1`–`FC44656` | Opening number corroborated, closing number single-source |
| Mk2 | `FC50001`–`FC88912` | Opening number corroborated, closing number single-source |
| Mk3 | `FD1`–`FD15306`, `FD20000`–`FD51967`, `FD75000`–`FD92803` | Single source |
| MkIV | `FH1`–`FH64995` | Closing number single-source; sources differ on whether the first car is `FH1` or `FH3` |
| 1500, rest of world | `FH75001` onwards | **Both sources agree** |
| 1500, North America | `FM28001` onwards | **Both sources agree** |

Two things about this table are worth saying plainly rather than burying.

**The Mk3 sequence has holes in it.** `FD15307`–`FD19999` and `FD51968`–`FD74999`
contain no recorded cars. If your Mk3 sits in one of those gaps, that is
interesting — please [submit it](/submit).

**The 1500 ranges have no end.** Neither source records a last number, so a `FH`
or `FM` number above the opening figure identifies the model but cannot date the
car. We would rather say that than invent a closing number.

Everything above rests on two club compilations, cross-checked against each
other, and neither is a factory record. Where they agree the table says so; where
only one of them speaks, the table says that too. The
[decoder](/reference/decoder) reports the same distinction for whatever number
you give it.

For any individual car, a
[British Motor Heritage certificate](/reference/heritage-certificates) is the
authoritative answer — it is drawn from the factory build records themselves.

Paste a number into the [decoder](/reference/decoder) to see what can be
established from it today.
