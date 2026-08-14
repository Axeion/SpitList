# Amicale Spitfire Club — Triumph Serial Numbers (Spitfire section)

- **URL:** http://www.amicalespitfire.org/technique/tableaux/serial.php
- **Page dated:** 16 April 2001, last modified 02/09/2018
- **Retrieved:** 2026-08-13 (screenshots supplied by the project owner; this
  environment cannot reach the host)
- **Credited contributors on the page:** Keith Bennett, Phil Willson, Terje Larssen

Transcribed verbatim. Where the page uses French column headings the English
equivalent from its sibling page is given in brackets.

## Stated conventions

> Commission Numbers : 'L' suffix for LHD, nothing for RHD, 'O' suffix for Overdrive

This independently confirms the suffix meanings already published on
`/reference/commission-numbers`.

## Spitfire

Columns: Model | Date | Qty (Production) | Comm. N° (N° ident.) | Body (Carross.)
| Engine (Moteur) | Gearbox (Boîte) | Diff (Pont) | Diff. Ratio (Rapport de pont)

| Model | Date | Qty | Comm. N° | Body | Engine | Gearbox | Diff | Ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 (MK1) | 10/62–12/64 | 45 573 | FC | 1 FC | FC | FC | FC | 4.11 |
| MK 2 | 12/64–1/67 | 37 409 | FC 50001 | – FC | FC50001 | FC | FC | 4.11 |
| MK 3 | 1/67–12/70 | 65 320 | FD | 81311 to 81732 FC, then 422 FD | FD | FD | FC | 4.11 |
| MK 3 USA | 1/67–12/70 | | FDU | | FE | FD | FC | 4.11 |
| MK IV | 11/70–12/74 | 70 021 | FH | 1 FH | FH | FH | FH | 3.89 |
| MK IV 1300 USA | 71–72 | | FK | | FK | FK | FK | 4.11 |
| MK IV 1500 USA | 73–74 | | FM | 1 FM | FM | FK | FH | 3.89 |
| MK IV 71 Sweden | 71 | | FL | | FL | FH | FH | 3.89 |
| 1500 | 12/74–10/79 | 95 829 | FH 75001 | 75001 FH | FM | FR | FR | 3.63 |
| 1500 USA | 75–79 | | FM 28001 | 28001 FM | FM 28001 UE | FT | FH 50001 | 3.89 |
| 1500 RHD | 10/79–08/80 | | TFADW1AT | | FM | FR | FR | 3.63 |
| 1500 RHD OVD | 10/79–08/80 | | TFADW5AT | | FM | FR | FR | 3.63 |
| 1500 LHD | 10/79–08/80 | | TFADW2AT | | FM | FR | FR | 3.63 |
| 1500 LHD OVD | 10/79–08/80 | | TFADW6AT | | FM | FR | FR | 3.63 |
| 1500 USA | 10/79–08/80 | | TFVDW2AT | | FM 109890 UE | FT | FH | 3.89 |
| 1500 USA OVD | 10/79–08/80 | | TFVDW6AT | | FM 109890 UE | FT | FH | 3.89 |
| 1500 California | 10/79–08/80 | | TFZDW2AT | | FM 109890 UCE | FT | FH | 3.89 |
| 1500 Calif. OVD | 10/79–08/80 | | TFZDW6AT | | FM 109890 UCE | FT | FH | 3.89 |
| 1500 Canada | 10/79–08/80 | | TFLDW2AT | | FM | FR | FR | 3.63 |
| 1500 Canada OVD | 10/79–08/80 | | TFLDW6AT | | FM | FR | FR | 3.63 |
| 1500 Canada | 1981 | | TFLDW2BT | | | | | |

## Spitfire gearboxes / overdrive

| Year | Gearbox | OVD |
| --- | --- | --- |
| 1971–1974 | 3 rails | D-Type |
| 1974–1975 | 3 rails | J-Type |
| after 1975 | Single Rail | J-Type |

## What this settles

1. **Mk1 production is 45,573**, agreeing with the Information Warehouse. Our
   `model_eras` seed said 45,753 — transposed digits. Fixed.
2. **Suffix meanings confirmed**: `L` = LHD, no suffix = RHD, `O` = overdrive.
3. **Starting commission numbers corroborated**: Mk2 at FC50001, 1500 at
   FH75001, US 1500 at FM28001. Range *ends* still come from one source only.
4. **FDU (Mk3 USA), FK (MkIV 1300 USA), FL (MkIV Sweden) confirmed.** `7FD`
   (Canadian Mk3) and `1FM` (Senneffe) appear in the Information Warehouse only
   and remain single-source.
5. **The late VIN prefixes decode completely** — see below. This is the most
   valuable part of the page for us.

## VIN prefixes, 1979–81

The five-letter prefix encodes the market, the digit encodes steering and
overdrive, and the trailing letter pair encodes the model year:

| Prefix | Market |
| --- | --- |
| `TFADW` | Home / general (RHD and LHD) |
| `TFVDW` | USA |
| `TFZDW` | California |
| `TFLDW` | Canada |

| Digit | Steering | Overdrive |
| --- | --- | --- |
| `1` | RHD | No |
| `2` | LHD | No |
| `5` | RHD | Yes |
| `6` | LHD | Yes |

| Trailing pair | Model year |
| --- | --- |
| `AT` | 1979–80 |
| `BT` | 1981 |

The digit table independently confirms the steering/overdrive mapping already
published from a separate source, so that part is now two-source verified.
