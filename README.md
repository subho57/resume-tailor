# Resume Superset Builder

A deterministic, schema-driven resume generator. You maintain **one JSON file** of
resume content plus a small **theme preset**; the TypeScript build script renders a
predictable `.docx` (and `.pdf`) every time. Hand a job description + the ground-truth
JSON to an LLM, ask it to emit a tailored JSON, drop that JSON into the same script,
and you get a matching DOCX + PDF — no manual formatting.

## Why JSON, not a DOCX, as the source of truth

A `.docx` is a *rendered artifact*: the facts are fused into OOXML runs, wrapped in
formatting, and split across XML elements. Getting a fact back out means parsing XML.
This system inverts that: **JSON is the source, the DOCX is the build output.** Content
and presentation are fully separated — the same content renders under any theme, and
tailoring is just "produce a smaller JSON."

## Architecture

```
schema/
  resume.schema.json     JSON Schema (2020-12) for CONTENT. Superset of JSON Resume.
                         Nearly every field optional -> partial docs still render.
  theme.schema.json      JSON Schema for a THEME preset. Strict (rejects unknown keys).
themes/
  corporate-navy.theme.json   Default theme (matches the canonical spec).
  slate-compact.theme.json    A denser, monochrome alternative.
data/
  priyanka.resume.json        The full ground-truth superset (renders multi-page).
  tailored-golang.example.json  Example trimmed/tailored doc (renders ~1-2 pages).
src/
  types.ts        TypeScript interfaces for content + theme.
  validate.ts     Best-effort JSON-Schema validator (warns; never hard-fails).
  theme.ts        Resolves a theme preset over defaults.
  render.ts       docx-js renderer (deterministic; honors theme, order, flags).
  pack.ts         Packs the .docx, converts to .pdf (LibreOffice), counts pages.
  autofit.ts      Single-page autofit loop (shrink spacing -> margins -> font).
  cli.ts          Command-line entry point.
```

## Install & build

```bash
npm install          # installs docx@9.7.1, typescript, @types/node
npm run build        # compiles src/ -> dist/
```

Requirements for PDF + autofit: **LibreOffice** (`soffice`) and **Poppler** (`pdfinfo`)
on PATH, plus a Calibri-metric-compatible font (**Carlito**) installed so page counts
match across machines.

## Usage

```bash
# Full ground-truth document (multi-page), default theme from the JSON:
node dist/cli.js --content data/priyanka.resume.json

# A tailored document, forced to one page:
node dist/cli.js --content data/tailored-golang.example.json --auto-fit-to-single-page

# Swap themes without touching content:
node dist/cli.js --content data/tailored-golang.example.json --theme slate-compact
```

### Options

| Flag | Meaning |
|---|---|
| `--content <path>` | **Required.** Resume content JSON. |
| `--theme <name\|path>` | Theme preset — a name (`corporate-navy`) resolved to `themes/<name>.theme.json`, or a `.json` path. Overrides `theme` in the content JSON. |
| `--out <dir>` | Output directory (default `./out`). |
| `--basename <name>` | Output filename base (default derived from `basics.name`). |
| `--auto-fit-to-single-page` | Iteratively shrink spacing, then margins, then font — within ATS-safe floors (10pt body, 0.5in margins by default) — to fit one page. Warns if it can't. |
| `--no-pdf` | Skip PDF (DOCX only). |
| `--strict` | Exit non-zero if any validation warning occurs (for CI). |
| `--quiet` | Suppress warning output. |

## The two-JSON contract

**Content** (`data/*.resume.json`) carries **zero** styling. It is a superset of the
[JSON Resume](https://jsonresume.org) standard — same field names where they exist
(`basics`, `work`, `education`, `skills`, `projects`, `certifications`, `languages`) —
extended with:

- `basics.summaries` — multiple named summary variants. The full doc lists them all;
  a tailored doc sets `basics.activeSummary` to pick one.
- `work[].roles[]` — multiple titles/date ranges within one company (promotions).
- `work[].domainNote` — a one-line italic descriptor of the company.
- `work[].highlights[]` items may be a plain string **or** `{ text, alt, flagged, note }`.
  A `flagged` highlight renders a Word comment carrying `note` (used to record
  reconciliations like "call sites = modules").
- `education[].score` + `scoreFlagged`/`scoreNote` — flag alternate values (e.g. the
  CGPA 9.28-vs-9.45 reconciliation).
- `openSource` — an open-source-contributions section with a verified/self-reported note.
- `recommendations`, `companyContext`, `preferences` — extensions beyond JSON Resume.
- `sectionOrder` — explicit render order; omitted sections are appended canonically.

**Theme** (`themes/*.theme.json`) carries **only** styling: `font.family`,
`font.baseSize`, `sizes`, `colors` (accent/body/rule/link), `margins`, `spacing`,
`ats.nonBreakingHyphens`, and the `autofit` floors/steps. It is validated strictly, so
a typo'd style key surfaces as a warning.

## Best-effort behavior (graceful degradation)

Validation **never hard-fails on content** (unless `--strict`). It:

- collects **all** issues as warnings,
- applies schema `default` values to missing fields,
- coerces obvious scalar mismatches (e.g. a phone number given as `12345` -> `"12345"`),
- and the renderer defensively treats wrong-typed lists as empty,

so an imperfect/partial JSON (such as raw LLM output) still produces a clean resume.
Provide the entire ground-truth JSON and you get the full multi-page document; provide
only a subset and you get a resume built from exactly what's present.

## Determinism notes

- Page size is pinned to US Letter (12240×15840 DXA); margins/derived widths compute
  from the theme.
- Word comments use **plain numeric ids** (`new CommentRangeStart(0)`), which avoids the
  docx v9 `[object Object]` serialization bug; `pack.ts` additionally repairs marker ids
  as a safety net.
- Compound terms get U+2011 non-breaking hyphens (toggle via `ats.nonBreakingHyphens`) so
  raw-stream ATS extractors don't drop hyphens at line-wrap boundaries.
- For identical page counts across environments, install **Carlito** (Calibri-metric
  compatible) and run the same LibreOffice version.

## Autofit

`--auto-fit-to-single-page` renders, converts to PDF, counts pages with `pdfinfo`, and if
> 1 page shrinks in this order: line-height/section spacing → margins → body font (with
proportional heading scaling and a 14pt name floor). It stops at the theme's `autofit`
floors (default 9.5pt body / 0.4in margins; ATS-safe is 10pt / 0.5in) and **warns** if a
single page isn't achievable — a signal to trim content rather than shrink into
unreadability. A genuine data dump (the full superset) will not collapse to one page;
that's expected.
