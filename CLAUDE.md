# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

---

# Project: Resume Superset Builder

Deterministic, schema-driven resume generator. One JSON file of resume content +
a small theme preset -> a predictable `.docx` (and `.pdf`) build, every time. Full
rationale and the content/theme JSON contract are documented in `README.md` —
read it before making schema or renderer changes.

## Commands

```sh
bun install                    # deps: docx@9.7.1, typescript, @types/node
bun run build                  # tsc -p tsconfig.json: src/ -> dist/ (commonjs)
bun dist/cli.js --content data/priyanka.resume.json                       # full ground-truth doc
bun dist/cli.js --content data/tailored-golang.example.json --one-pager
bun dist/cli.js --content <file> --theme slate-compact                   # swap theme only
bun run compile                # bun build --compile -> bin/build-resume (standalone binary)
```

There is no test suite yet (`bun test` has nothing to run). Validate changes by
building and generating both `data/priyanka.resume.json` (multi-page) and
`data/tailored-golang.example.json` (should autofit to 1-2 pages) and inspecting
the resulting DOCX/PDF in `./out`.

`dist/` and `out/` are gitignored (not committed) — always run `bun run build`
before `bun dist/cli.js ...` after a fresh clone or a `src/` change; there is no
prebuilt `dist/` to fall back on.

Always invoke the CLI with `bun dist/cli.js`, not `node dist/cli.js`: `package.json`
sets `"type": "module"` but `tsconfig.json` compiles to CommonJS, so plain Node
throws `ReferenceError: exports is not defined in ES module scope` on the compiled
output. Bun runs it fine regardless. If you ever see that exact error, it means a
command used `node` instead of `bun` — swap it, don't touch the module settings.

If `bun run build` fails with `TS5103: Invalid value for '--ignoreDeprecations'`,
`tsconfig.json`'s `ignoreDeprecations` value is ahead of the installed `typescript`
devDependency (it must match the installed compiler's major version, e.g. `"5.0"`
for TypeScript 5.x) — fix the value, don't suppress the check differently.

PDF + autofit require **LibreOffice** (`soffice`) and **Poppler** (`pdfinfo`) on
PATH, plus the **Carlito** font installed (Calibri-metric-compatible, keeps page
counts identical across machines). See `README.md`'s "Prerequisites" section for
per-OS install commands. `src/pack.ts`'s `checkPdfToolchain()` detects both
binaries up front (via `Bun.which`, no subprocess spawn) so the CLI can name
exactly what's missing and how to install it, instead of failing silently deep
inside the autofit loop or the final PDF step. DOCX generation itself has zero
external dependency and always works even with neither binary present.

`--keywords <comma,list>` bolds matching terms in Summary/Work-bullets/Projects
(`src/render.ts`'s `buildBoldPattern()` + `textRuns()`). It's threaded as a 3rd
param through `renderResume()` and `autofitToSinglePage()`/`measure()` in
`src/autofit.ts` — never stored in content or theme JSON, since it's a run-specific
rendering directive, not a fact about the candidate or a reusable style choice.

`bin/` is gitignored — `bun run compile`'s output, a platform/arch-specific standalone
executable, not committed. `src/cli.ts` statically imports the 2 schemas and the 2
shipped theme presets (`BUILTIN_THEMES`) specifically so Bun's bundler embeds them;
without that, the compiled binary's `__dirname` resolves to Bun's virtual filesystem,
not a real directory, and `schema/`/`themes/` fs lookups would silently fail. Adding a
new theme preset needs a line in `BUILTIN_THEMES` too, or the compiled binary won't
see it even after `themes/<name>.theme.json` exists on disk.

`--version`/`-v` prints `package.json`'s `version`, statically imported in `cli.ts`
for the same reason as `BUILTIN_THEMES` (compiled-binary `__dirname` can't fs-read it).

Releases are fully automatic via `.github/workflows/release.yml` + semantic-release
(`.releaserc.json`) — every push to `main` is analyzed for Conventional Commits
(`fix:`/`feat:`/`BREAKING CHANGE:`); if release-worthy, a `release` job bumps
`package.json`, writes `CHANGELOG.md`, commits both back with `[skip ci]`, tags, and
creates the GitHub Release, then `build` (needs: release, conditional on
`published == 'true'`) cross-compiles all 6 `bun-{linux,darwin,windows}-{x64,arm64}`
targets from one `ubuntu-latest` runner (Bun downloads the target platform's runtime
for `--compile`) against the now-bumped version, and `attach` uploads the binaries +
`SHA256SUMS.txt` onto the release. **Never hand-edit `package.json`'s `version` or
create a release tag manually** — semantic-release owns both; a manual edit can
directly conflict with what it computes on the next run.

**Known bug, not yet root-caused:** under rapid repeated conversions within one
`--one-pager` run, `src/pack.ts`'s `convertToPdf`/`countPdfPages` can
occasionally return a stably-wrong (not flaky) page count for a mid-loop measurement —
autofit reports "fit to 1 page" while the actual final PDF is 2. Reproduces identically
via `bun dist/cli.js` and the compiled binary, so it's a pre-existing pipeline issue,
not something either packaging path introduces. Tried and ruled out as full fixes:
deleting stale pre-existing output files (kept — real, if partial, benefit), a fresh
temp directory per measurement call (kept — cheap, no proven downside), and a
`countPdfPages` multi-read-agreement retry loop (reverted — added multi-second latency
without reliably fixing it). `autofit.ts`'s `-1`-vs-"fits" conflation was a separate,
confirmed-real bug and is fixed (`measureReliably()`'s `giveUp` path). If you pick this
back up: the pattern (stable-wrong, not fluctuating) suggests something more specific
than a simple write-flush race — investigate with `DEBUG_AUTOFIT=1` (prints each
`measure()` call's pdfPath/pages/theme state to stderr) before adding more polling.

## Architecture

- `schema/resume.schema.json` — JSON Schema (2020-12) for CONTENT. Superset of
  JSON Resume; nearly every field optional so partial docs still render.
- `schema/theme.schema.json` — JSON Schema for a THEME preset. Strict (rejects
  unknown keys).
- `themes/*.theme.json` — theme presets (`corporate-navy` default, `slate-compact`
  a denser monochrome alternative).
- `data/*.resume.json` — content instances: the full ground-truth superset plus
  tailored/trimmed examples.
- `src/types.ts` — TS interfaces for content + theme.
- `src/validate.ts` — best-effort JSON-Schema validator: collects all issues as
  warnings, applies schema defaults, coerces obvious scalar mismatches; **never
  hard-fails on content** unless `--strict` is passed.
- `src/theme.ts` — resolves a theme preset over built-in defaults.
- `src/render.ts` — docx-js renderer; deterministic, honors theme/order/flags.
- `src/pack.ts` — packs the `.docx`, exposes `checkPdfToolchain()` for
  soffice/pdfinfo preflight detection, converts to `.pdf` via LibreOffice, counts
  pages via `pdfinfo`.
- `src/autofit.ts` — single-page autofit loop: shrinks line-height/spacing, then
  margins, then body font (with proportional heading scaling, 14pt name floor),
  stopping at theme-defined floors and warning if a single page isn't reachable.
- `src/cli.ts` — argument parsing and orchestration (validate -> resolve theme ->
  optional autofit -> render -> pack -> convert to PDF).

Data flow: content JSON + theme JSON -> `validate` (both, independently) ->
`resolveTheme` -> (`autofitToSinglePage` if requested, which internally re-renders
and re-packs to measure pages) -> `renderResume` -> `packDocx` -> `convertToPdf`.

## Key invariants (see README "Determinism notes" for full detail)

- Page size pinned to US Letter (12240x15840 DXA); everything else derives from
  the theme.
- Word comments (used for `flagged` highlights) use plain numeric ids
  (`new CommentRangeStart(0)`) to dodge a docx v9 serialization bug; `pack.ts`
  repairs marker ids as a second safety net.
- Compound-term hyphens render as plain ASCII hyphens (`ats()` in `render.ts` is a
  no-op). Non-breaking-hyphen protection was attempted (both the literal U+2011
  character and docx's `NoBreakHyphen` run-child were tried) but Carlito, the
  required font, has no glyph at U+2010/U+2011 — either approach renders as a tofu
  box in LibreOffice's PDF export. Don't reintroduce U+2011/`NoBreakHyphen` for this
  unless Carlito is replaced with a font that has full punctuation coverage.
  `ats.nonBreakingHyphens` stays in the theme schema for that future case but
  currently has no effect.
- "Left ... right-aligned" lines (company header, role line, education line, all
  built through `render.ts`'s shared `leftRight()` helper) must insert docx's real
  `Tab` run-child (`new TextRun({ children: [new Tab(), rightText] })`), never a
  literal `"\t"` inside a `TextRun`'s `text` string — both Word and LibreOffice
  treat a bare tab character as ordinary collapsible whitespace, not a jump to the
  configured `TabStopType.RIGHT` stop, so the date silently glues to the preceding
  text instead of right-aligning.
- A company's role line only shows its own date range when there's more than one
  displayed role (`roles.length > 1` after `roleDisplay` collapsing in `render.ts`'s
  `work()` section). A single role's dates always duplicate the company header
  line directly above, so that case renders position-only, no `leftRight()`/date.
- Content carries zero styling; themes carry only styling
  (`font`, `sizes`, `colors`, `margins`, `spacing`, `ats`, `autofit`). Don't let
  either leak into the other when adding fields.
- `--keywords` bold-matching uses lookaround boundaries
  (`(?<![A-Za-z0-9])term(?![A-Za-z0-9])`) in `buildBoldPattern()`, not `\b` — `\b` is
  defined relative to `\w` and misfires around symbol-bearing terms like "CI/CD" or
  "Node.js". This mirrors `scripts/check_keywords.py`'s `term_present()`; keep the
  two in sync if either changes.

## Tailoring workflow

The `.claude/skills/jd-tailored-resume/` project skill turns a job description
into a tailored resume: it reverse-engineers the JD's priorities/keywords, selects
and rephrases (never fabricates) content from the ground-truth superset in
`data/`, writes a new tailored content JSON, and renders it through this CLI. By
convention, working JD text files live in `jds/` and generated tailored
`<name>.resume.json` + `.docx` + `.pdf` triples live in `output/` (both untracked
scratch directories, distinct from `data/`'s committed ground truth and the
default `./out` the bare CLI writes to).
