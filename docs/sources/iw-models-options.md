# Spitfire & GT6 Information Warehouse — Models and Options

- **URL:** https://triumphspitfire.com/reference-pages/spitfire-gt6-models-and-options/
- **Retrieved:** 2026-08-13 (saved as MHTML by the project owner; this
  environment cannot reach the host)

Transcribed verbatim from the saved page. Only the Spitfire sections are
reproduced; the page also covers GT6.

## Spitfire 4 (Mk1)

> Oct. 1962 (1963 model year)–Dec. 64 (1965 model year),
> Commission # FC1- FC44656
> 45573 cars made.

## Spitfire Mk2

> Dec. 1964 (1965 model year) –Jan. 1967 (1967 model year),
> Commission # FC50001-FC88912
> 37409 cars made.
> The last Mk 2 was make January 1967 and had Commission number FC88912.

## Spitfire Mk3

> Commission # – FD1-FD15306, FD20000-FD51967, FD75000-FD92803 (after Oct.
> 1969), FDU prefix for US, O suffix for cars fitted with overdrive
> transmissions, 7FD prefix for some (all?) Canadian cars.
> 65320 cars made.

## Spitfire Mk4

> world: Nov. 1970 (1971 model year)–Nov. 1974
> Commission #FH3-FH64995 (US used FK & FM),
> FK prefix for US 1300's, FM for US 1500's, FL for Sweden, a few US bound 1974
> 1500's were built in Seniffe Belgium-1FM prefix and IU suffix, O suffix for
> cars fitted with overdrive transmissions.
> 70021 cars made.

> US 1973 & 74 cars (FM commission numbers) received the 1500cc engine (to try to
> counteract the strangulating emissions regs in the US) while the rest of the
> world stayed Mk4's with 1296cc engine. These cars were essentially MkIV's with
> 1500 badges and engine.
> In Nov. 74 all Spitfires received the 1500cc engine and were officially called
> "Spitfire 1500".

## Spitfire 1500

> UK/Europe: FH75001 onwards, US: FM28001U onwards (late 1979 & 80 used VIN
> numbers ), U suffix for US, UC suffix for US California, O suffix for cars
> fitted with overdrive transmissions, **L suffix for Right hand drive**
> 95829 cars made (91137 excluding 73 & 74 models)

## From the sibling page, "What Year Is My Car?"

- https://triumphspitfire.com/reference-pages/what-year-is-my-car/
- Contains no ranges of its own; it explains model year versus build year and
  links out to charts.

> Example: if your number is FM29851U then your car is a "1975" Spitfire.

> Model Year: cars that were built up to Sept 74 were 1974's… after Sept 74 they
> were "1975" models (the car had 1975's required parts). The factory built
> "next year's" models starting a few months before that year actually got there.

This is the same judgement `/reference/commission-numbers` and the `model_year`
/ `build_year` split already encode: where build date and registration disagree,
registration wins.

## Conflict with the other source

**This page states `L` suffix = right-hand drive.** The Amicale Spitfire Club
tables state the opposite — "'L' suffix for LHD, nothing for RHD" — and the
Vintage Triumph Register and team.net prefix list agree with the Amicale.

Three sources to one. `L` is **left-hand drive**, which is what
`/reference/commission-numbers` and `src/lib/decode.ts` already publish. No
change needed, but the disagreement is recorded here rather than quietly
resolved, because it is exactly the failure the two-source rule exists to catch.

## Single-source items

Present here and **not** corroborated by the Amicale tables:

- Range *ends*: FC44656, FC88912, FD15306 / FD51967 / FD92803, FH64995
- The three-block structure of the Mk3 sequence
- `7FD` prefix for Canadian Mk3s (the page itself hedges: "some (all?)")
- `1FM` prefix and `IU` suffix for Senneffe-built cars
- `UC` suffix for California

These are seeded with `verified = false` and the decoder qualifies them.
