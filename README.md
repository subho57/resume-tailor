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
bun install          # installs docx@9.7.1, typescript, @types/node
bun run build        # compiles src/ -> dist/
```

Requirements for PDF + autofit: **LibreOffice** (`soffice`) and **Poppler** (`pdfinfo`)
on PATH, plus a Calibri-metric-compatible font (**Carlito**) installed so page counts
match across machines. See "## Prerequisites" below for install commands. DOCX
generation itself has no external dependency and always works; only
`--auto-fit-to-single-page` and PDF output need these. If either binary is missing,
the CLI prints an actionable warning naming exactly what's absent and how to
install it, rather than silently skipping PDF/autofit.

## Prerequisites

Only needed for PDF output and `--auto-fit-to-single-page`; DOCX-only builds need
nothing beyond `bun install`.

**macOS:**
```bash
brew install --cask libreoffice
brew install poppler
brew install --cask font-carlito
```

**Debian/Ubuntu:**
```bash
sudo apt install libreoffice poppler-utils fonts-crosextra-carlito
```

**Windows:** install [LibreOffice](https://www.libreoffice.org/download/) and
[Poppler for Windows](https://github.com/oschwartz10612/poppler-windows/releases/)
manually, adding both to PATH; install the Carlito font from the same Google
Fonts / Crosextra sources used above.

## Usage

```bash
# Full ground-truth document (multi-page), default theme from the JSON:
bun dist/cli.js --content data/priyanka.resume.json

# A tailored document, forced to one page:
bun dist/cli.js --content data/tailored-golang.example.json --auto-fit-to-single-page

# Swap themes without touching content:
bun dist/cli.js --content data/tailored-golang.example.json --theme slate-compact
```

Always run with `bun`, not `node`: `package.json` sets `"type": "module"` but the
compiled output is CommonJS, so plain Node throws `ReferenceError: exports is not
defined in ES module scope`. Bun runs it fine regardless.

## Standalone binary

For a single `build-resume` command usable from anywhere, without typing
`bun dist/cli.js` or needing to be in this repo's directory:

```bash
bun run compile                # bun build --compile --outfile=bin/build-resume ./src/cli.ts
cp bin/build-resume ~/.bun/bin/   # any directory already on PATH works
build-resume --content data/priyanka.resume.json --auto-fit-to-single-page
```

`bun build --compile` bundles the JS, the Bun runtime, and all npm dependencies
(`docx`, etc.) into one self-contained executable (~90MB) — no `bun`/`node` or
`node_modules` needed to run it afterward. The two shipped theme presets
(`corporate-navy`, `slate-compact`) and both JSON schemas are statically imported in
`src/cli.ts` specifically so Bun's bundler embeds them into the binary; a custom
`--theme <path.json>` or `--schema <path.json>` still reads from disk as normal.

The binary is a frozen snapshot: rebuild and re-copy (`bun run compile`) after
changing anything in `src/`, `schema/`, or `themes/` — unlike `bun dist/cli.js`, it
won't pick up edits automatically. Adding a new theme preset also needs a line in
`src/cli.ts`'s `BUILTIN_THEMES` map to be embedded in future compiles.

## Releases

Prebuilt binaries for Linux, macOS, and Windows (x64 + arm64) are published to
[GitHub Releases](https://github.com/subho57/resume-builder/releases) by
`.github/workflows/release.yml` whenever a `vX.Y.Z` tag is pushed. This repo is
private, so downloading a release asset needs repo access (`gh release download`
while authenticated, or a browser session logged in with access).

| Asset | Platform |
|---|---|
| `build-resume-linux-x64` | Linux, x86_64 |
| `build-resume-linux-arm64` | Linux, ARM64 |
| `build-resume-macos-x64` | macOS, Intel |
| `build-resume-macos-arm64` | macOS, Apple Silicon |
| `build-resume-windows-x64.exe` | Windows, x86_64 |
| `build-resume-windows-arm64.exe` | Windows, ARM64 |

A `SHA256SUMS.txt` manifest is attached to each release for integrity verification.
Download the matching asset, `chmod +x` it (Linux/macOS), put it on PATH, and run
`build-resume --version` to confirm.

**Cutting a release:** bump `version` in `package.json`, commit, then:
```bash
git tag v1.1.0      # must match package.json's version, or the workflow fails the build
git push --tags
```
The workflow cross-compiles all 6 targets from a single Linux runner (Bun downloads
the target platform's runtime for `--compile`, no per-OS runners needed), verifies the
tag matches `package.json`'s version, and publishes a GitHub Release with all
binaries + checksums attached. `workflow_dispatch` runs the same build matrix on
demand without publishing a release — useful for testing the pipeline itself.

### Options

| Flag | Meaning |
|---|---|
| `--content <path>` | **Required.** Resume content JSON. |
| `--theme <name\|path>` | Theme preset — a name (`corporate-navy`) resolved to `themes/<name>.theme.json`, or a `.json` path. Overrides `theme` in the content JSON. |
| `--out <dir>` | Output directory (default `./out`). |
| `--basename <name>` | Output filename base (default derived from `basics.name`). |
| `--auto-fit-to-single-page` | Iteratively shrink spacing, then margins, then font — within ATS-safe floors (10pt body, 0.5in margins by default) — to fit one page. Warns if it can't. |
| `--no-pdf` | Skip PDF (DOCX only). |
| `--keywords <comma,list>` | Bold these terms wherever they occur in the Summary, Work-experience bullets, and Projects (case-insensitive, whole-term matching — punctuation-safe, so "CI/CD" and "Node.js" match correctly). Not stored in the content or theme JSON; a render-time-only directive, same tier as autofit. Skills/Education/company headers/dates are unaffected. |
| `--strict` | Exit non-zero if any validation warning occurs (for CI). |
| `--quiet` | Suppress warning output. |
| `--version`, `-v` | Print the version (from `package.json`, embedded at compile time) and exit. |

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
- Compound-term hyphens render as plain ASCII hyphens. `ats.nonBreakingHyphens`
  exists in the theme schema for a planned non-breaking-hyphen protection, but it's
  currently a no-op: Carlito (the required font) has no glyph at U+2010/U+2011, and
  both the literal character and docx's `NoBreakHyphen` run-child resolve to that
  same glyph, so either renders as a tofu box in LibreOffice's PDF export. A visible,
  correct hyphen beats an invisible missing-glyph box.
- For identical page counts across environments, install **Carlito** (Calibri-metric
  compatible) and run the same LibreOffice version.
- `--keywords` matching uses lookaround boundaries (`(?<![A-Za-z0-9])term(?![A-Za-z0-9])`),
  not `\b`, so punctuation-bearing terms ("CI/CD", "Node.js") match correctly — `\b` is
  defined relative to `\w` and misfires around symbols. Mirrors the same boundary logic
  in `scripts/check_keywords.py`'s `term_present()`. If autofit is also requested, both
  the measurement passes and the final render use the same keyword list, since bold
  glyphs are slightly wider and can shift line-wrapping/pagination.

## Autofit

`--auto-fit-to-single-page` renders, converts to PDF, counts pages with `pdfinfo`, and if
> 1 page shrinks in this order: line-height/section spacing → margins → body font (with
proportional heading scaling and a 14pt name floor). It stops at the theme's `autofit`
floors (default 9.5pt body / 0.4in margins; ATS-safe is 10pt / 0.5in) and **warns** if a
single page isn't achievable — a signal to trim content rather than shrink into
unreadability. A genuine data dump (the full superset) will not collapse to one page;
that's expected.

**Known reliability gap:** under rapid repeated conversions in one autofit run,
`soffice`/`pdfinfo` can occasionally report a stably-wrong (not flaky/fluctuating)
page count for a mid-loop measurement, causing autofit to report "fit to 1 page" when
the final PDF is actually 2. This is a pre-existing issue in the LibreOffice-invocation
pipeline (`src/pack.ts`'s `convertToPdf`/`countPdfPages`), reproduces identically via
`bun dist/cli.js` and the compiled `build-resume` binary alike, and is not fully
root-caused yet. Mitigated (file staleness reduced by deleting any pre-existing output
file first, and a real independent `-1`-vs-"fits" conflation bug in `autofit.ts`'s loop
is fixed) but not eliminated. If a delivered PDF's page count looks off, open it and
check — don't fully trust the "fit to 1 page" log line yet.
