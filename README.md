# resume-tailor

A deterministic, schema-driven resume generator. You maintain **one JSON file** of
resume content plus a small **theme preset**; the TypeScript build script renders a
predictable `.docx` (and `.pdf`) every time. Hand a job description + the ground-truth
JSON to an LLM, ask it to emit a tailored JSON, drop that JSON into the same script,
and you get a matching DOCX + PDF — no manual formatting.

**Try it online:** [subho57.github.io/resume-tailor](https://subho57.github.io/resume-tailor/) —
a client-side-only demo (no server, no account) that renders a `.docx` straight in
your browser from a sample or pasted JSON. PDF export and `--one-pager` autofit need
LibreOffice/Poppler, so they're CLI-only — see "Standalone binary" below.

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
site/
  Client-side browser demo (Vite + CodeMirror), deployed to GitHub Pages.
  Reuses render.ts/theme.ts/validate.ts/types.ts unmodified; no LibreOffice/
  Poppler in the browser, so no PDF export or --one-pager there. Own dev
  workflow: `cd site && bun install && bun run dev`.
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
`--one-pager` and PDF output need these. If either binary is missing,
the CLI prints an actionable warning naming exactly what's absent and how to
install it, rather than silently skipping PDF/autofit.

## Prerequisites

Only needed for PDF output and `--one-pager`; DOCX-only builds need
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
bun dist/cli.js --content data/tailored-golang.example.json --one-pager

# Swap themes without touching content:
bun dist/cli.js --content data/tailored-golang.example.json --theme slate-compact
```

Always run with `bun`, not `node`: `package.json` sets `"type": "module"` but the
compiled output is CommonJS, so plain Node throws `ReferenceError: exports is not
defined in ES module scope`. Bun runs it fine regardless.

## Standalone binary

For a single `tailor-resume` command usable from anywhere, without typing
`bun dist/cli.js` or needing to be in this repo's directory:

**macOS/Linux, one line** (downloads the latest release, installs to
`~/.local/bin`, runs `--install-skill`, and checks LibreOffice/Poppler/Carlito
prerequisites via `brew`/`apt`/`dnf`):

```bash
curl -fsSL https://subho57.github.io/resume-tailor/install.sh | bash
```

**Windows:** Beta — download
[`tailor-resume-windows-x64.zip`](https://github.com/subho57/resume-tailor/releases/latest/download/tailor-resume-windows-x64.zip)
from the latest release and put it on PATH manually; `install.sh` doesn't cover
Windows.

**Or build from source:**

```bash
bun run compile                # bun build --compile --outfile=bin/tailor-resume ./src/cli.ts
cp bin/tailor-resume ~/.bun/bin/   # any directory already on PATH works
tailor-resume --content data/priyanka.resume.json --one-pager
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

### Installing the JD-tailoring skill

```bash
tailor-resume --install-skill
```

Installs a **standalone variant** of the `jd-tailored-resume` Claude Code skill to
`~/.claude/skills/jd-tailored-resume/` — a personal skill usable from any project,
not just this repo checkout. It's the same tailoring workflow, generated from this
repo's own `.claude/skills/jd-tailored-resume/` at build time
(`scripts/generate-skill-bundle.ts`), with the repo-specific instructions (`bun
dist/cli.js`, `data/*.resume.json` in the repo root, the install/build step)
rewritten to invoke `tailor-resume` directly — no repo, no build step, themes and
schemas are already embedded in the binary. Re-run `--install-skill` any time to
update it. This doesn't touch or read this repo's own `.claude/skills/` copy, which
stays exactly as-is for in-repo use.

## Releases

Releases are fully automatic — **no manual tagging.** Every push to `main` runs
`.github/workflows/release.yml`, which uses [semantic-release](https://semantic-release.gitbook.io/)
to decide whether the commits since the last release warrant a new one, based on
[Conventional Commits](https://www.conventionalcommits.org/):

- `fix: ...` → patch release
- `feat: ...` → minor release
- `feat!: ...` / a `BREAKING CHANGE:` footer → major release
- `docs:`, `chore:`, `refactor:`, `ci:`, `test:`, etc. → **no release** (by design —
  this is what makes it "semantic," not "every push produces a release")

When a release fires, semantic-release bumps `package.json`'s `version`, writes
`CHANGELOG.md`, commits both back to `main` (tagged `[skip ci]`, so that commit
doesn't retrigger the workflow), creates the git tag, and creates the GitHub Release.
A follow-up job then cross-compiles all 6 targets (embedding the version just
decided — this is why the compile step waits for the version-bump commit rather than
building first), archives each binary into a per-platform `.tar.gz`/`.zip` (so the
executable bit survives both the CI artifact-passing step and the end user's
download — see "Prebuilt binaries" below), and attaches the archives + a
`SHA256SUMS.txt` manifest.

**To cut a release:** just write commits with the right prefix and push/merge to
`main`. Nothing else to do. `workflow_dispatch` re-runs the same pipeline on demand
(e.g. to test it) — it still only publishes if there's something release-worthy.

Don't hand-edit `package.json`'s `version` or create git tags manually — semantic-
release owns both, and a manual edit can conflict with what it computes next.

Prebuilt binaries are published to
[GitHub Releases](https://github.com/subho57/resume-tailor/releases) — the repo is
public, so anyone can download a release asset directly, no authentication needed.

| Asset | Platform |
|---|---|
| `tailor-resume-linux-x64.tar.gz` | Linux, x86_64 |
| `tailor-resume-linux-arm64.tar.gz` | Linux, ARM64 |
| `tailor-resume-macos-x64.tar.gz` | macOS, Intel |
| `tailor-resume-macos-arm64.tar.gz` | macOS, Apple Silicon |
| `tailor-resume-windows-x64.zip` | Windows, x86_64 |
| `tailor-resume-windows-arm64.zip` | Windows, ARM64 |

A `SHA256SUMS.txt` manifest is attached to each release for integrity verification
(checksums cover the archives themselves, not their extracted contents). Download
the matching archive and extract it — `tar -xzf tailor-resume-<platform>.tar.gz` on
Linux/macOS, or unzip on Windows. The binary inside (`tailor-resume` /
`tailor-resume.exe`) comes out already executable; no manual `chmod +x` needed —
tar's own format preserves the Unix executable bit through extraction, unlike a
raw binary downloaded directly as a release asset. Put it on PATH and run
`tailor-resume --version` to confirm.

### Options

| Flag | Meaning |
|---|---|
| `--content <path>` | **Required.** Resume content JSON. |
| `--theme <name\|path>` | Theme preset — a name (`corporate-navy`) resolved to `themes/<name>.theme.json`, or a `.json` path. Overrides `theme` in the content JSON. |
| `--out <dir>` | Output directory (default `./out`). |
| `--basename <name>` | Output filename base (default derived from `basics.name`). |
| `--one-pager` | Iteratively shrink spacing, then margins, then font — within ATS-safe floors (10pt body, 0.5in margins by default) — to fit one page. Warns if it can't. |
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

`--one-pager` renders, converts to PDF, counts pages with `pdfinfo`, and if
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
`bun dist/cli.js` and the compiled `tailor-resume` binary alike, and is not fully
root-caused yet. Mitigated (file staleness reduced by deleting any pre-existing output
file first, and a real independent `-1`-vs-"fits" conflation bug in `autofit.ts`'s loop
is fixed) but not eliminated. If a delivered PDF's page count looks off, open it and
check — don't fully trust the "fit to 1 page" log line yet.
