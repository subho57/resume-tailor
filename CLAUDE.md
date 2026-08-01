# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime: Bun, not Node

- `bun install` / `bun run <script>` / `bunx <pkg>` — not npm/yarn/pnpm/npx.
- `bun <file>` runs TS directly; `bun test` for tests (none exist yet — validate by
  building + generating, see below). Bun auto-loads `.env`; don't add `dotenv`.
- Bun runtime APIs deliberately used: `Bun.which` (toolchain detection), `Bun.file()`
  + `Bun.write()` (file I/O), Bun Shell `` $`...` `` (subprocesses). `fs.mkdirSync`/
  `chmodSync`/`rmSync`/`mkdtempSync` and all `path.*`/`os.*` calls deliberately stay on
  `node:` imports — Bun has no native equivalent.

(Deterministic CLI emitting DOCX/PDF — no server, DB, or frontend, so the generic
Bun `Bun.serve`/SQLite/React/Tailwind starter notes don't apply here.)

---

# Project: Resume Superset Builder

Deterministic, schema-driven resume generator. One JSON file of resume content +
a small theme preset -> a predictable `.docx` (and `.pdf`) build, every time. Full
rationale and the content/theme JSON contract are documented in `README.md` —
read it before making schema or renderer changes.

## Commands

```sh
bun install                    # runtime dep: docx@9.7.1; dev: typescript, @types/node, @types/bun, semantic-release
bun run build                  # tsc -p tsconfig.json: src/ -> dist/ (commonjs)
bun dist/cli.js --content data/priyanka.resume.json                       # full ground-truth doc
bun dist/cli.js --content data/tailored-golang.example.json --one-pager
bun dist/cli.js --content <file> --theme slate-compact                   # swap theme only
bun run compile                # bun build --compile -> bin/tailor-resume (standalone binary)
bun run generate               # shortcut for the priyanka.resume.json full-doc command above
bun run generate:onepage       # same, with --one-pager
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

`tsconfig.json` has no `moduleResolution` or `types`-suppressing flags left to babysit
across a TypeScript major bump — `moduleResolution: "node10"` (and the
`ignoreDeprecations: "5.0"` that silenced its deprecation warning under TS 5.x) were
both removed when the project moved to TypeScript 7: `"node10"` was removed outright
as a valid value (not just deprecated), and once it was gone `ignoreDeprecations` had
nothing left to suppress. `moduleResolution` is now left unset (TS infers the right
default for `module: "commonjs"`); an explicit `"types": ["bun", "node"]` was added
because TS 7 stopped auto-including `@types/bun`'s ambient globals (`Bun.which` in
`src/pack.ts`) without it — omitting `types` now silently drops `@types/bun` instead
of including everything under `@types/` like TS 5 did, so `Bun` reads as undefined
with no warning, only a `Cannot find name 'Bun'` compile error. If a future
TypeScript major reintroduces either kind of breakage, re-check both settings rather
than assuming this is a one-time fix.

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

`--install-skill [name]` writes a standalone variant of one (or, with no `name`,
every) bundled project skill to **both** `~/.claude/skills/<name>/` and
`~/.copilot/skills/<name>/` (personal skill, any project, no repo — same content,
either assistant's *personal* skill directory). Currently bundled:
`jd-tailored-resume` and `master-resume-builder`. There is deliberately **no**
repo-committed `.copilot/skills/` mirror for *project*-scope use — GitHub Copilot
CLI's own project-skill discovery already falls back to `.claude/skills/` (verified
by inspecting the installed `copilot` CLI's own bundle: its skill-loading help text
lists `.github/skills/`, `.agents/skills/`, and `.claude/skills/` as the three
project sources, `~/.copilot/skills/` and `~/.agents/skills/` as the two personal
ones — no project-scope `.copilot/skills/` exists in its discovery order), so a
repo copy of it would just be dead weight. Source of truth is still each skill's
own `.claude/skills/<name>/` directory — never edit
`src/skill-bundle.generated.ts` or a standalone skill's installed content by hand;
edit the real `.claude/skills/<name>/` files and re-generate.
`scripts/generate-skill-bundle.ts` (run via the `bun run prepare-skill` script,
which `build` and `compile` both run first) defines a `SKILLS` list — one entry per
bundled skill, each with its own `transformSkillMd` function and list of extra
files (e.g. `references/tailoring-guide.md`, `scripts/check_keywords.py` for
`jd-tailored-resume`; `references/research-guide.md` for `master-resume-builder`) —
and rewrites each skill's own repo/bun-specific anchor regions in its `SKILL.md`
(repo/bun instructions -> `tailor-resume` instructions) via an `assertReplace()`
helper that **throws if an anchor isn't found exactly once** — so editing a
`SKILL.md` in a way that moves/rewords one of its anchors fails the next `bun run
build`/`bun run compile` loudly, instead of silently shipping a stale standalone
skill. The Claude standalone output is the only hand-written transform target; the
Copilot personal-install variant is derived from it mechanically by
`deriveCopilotSkillMd()` — just `.claude/skills` -> `.copilot/skills` in the
standalone doc's own prose (its "installed at `~/...`" self-description), nothing
else differs, since both tools parse the same SKILL.md frontmatter format (YAML,
`name`+`description` required, unknown fields tolerated with a warning rather than
rejected — also confirmed against the installed `copilot` CLI bundle, not assumed).
**Do not reintroduce a `trigger: <field>` in that derivation** — an earlier version
of this code injected `trigger: /<name>`, believing it bound a Copilot slash
command; it doesn't exist in Copilot's actual schema and was a misreading of an
unrelated internal telemetry enum sharing the name. To bundle a new skill, add a
`SkillSpec` entry to the `SKILLS` array (a no-op `(c) => c` transform is fine if it
has no repo-specific anchors). `jd-tailored-resume/evals/evals.json` is
intentionally excluded (author-only test content, not needed at invocation time).
`src/skill-bundle.generated.ts` is gitignored (regenerate with `bun run
prepare-skill` if it's missing — needed before running `bun src/cli.ts` directly,
since that bypasses both the `build`/`compile` scripts that normally generate it
first).

Releases are fully automatic via `.github/workflows/release.yml` + semantic-release
(`.releaserc.json`) — every push to `main` is analyzed for Conventional Commits
(`fix:`/`feat:`/`BREAKING CHANGE:`); if release-worthy, a `release` job bumps
`package.json`, writes `CHANGELOG.md`, commits both back with `[skip ci]`, tags, and
creates the GitHub Release, then `build` (needs: release, conditional on
`published == 'true'`) cross-compiles all 6 `bun-{linux,darwin,windows}-{x64,arm64}`
targets from one `ubuntu-latest` runner (Bun downloads the target platform's runtime
for `--compile`) against the now-bumped version, archives each binary into a
`.tar.gz` (Linux/macOS) or `.zip` (Windows) **before** `actions/upload-artifact`,
and `attach` uploads the archives + `SHA256SUMS.txt` onto the release. The archiving
step exists specifically so the Unix executable bit survives — both
`actions/upload-artifact`/`download-artifact`'s zip round trip (a documented
GitHub Actions limitation: it drops the executable bit on a *raw* uploaded file,
though tar/zip's own per-entry permission metadata inside an already-archived file
passes through unaffected) and a plain HTTP release-asset download (which carries
no Unix permission metadata at all for a raw binary, unlike an archive format that
encodes the mode itself and restores it on extraction). Do the archiving in the
`build` job, before `upload-artifact` — doing it later in `attach`, after the
round trip, is too late to matter for the CI-side loss and doesn't help end users
either. **Never hand-edit `package.json`'s `version` or create a release tag
manually** — semantic-release owns both; a manual edit can directly conflict with
what it computes on the next run.

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
- `src/node-shim.d.ts` — ambient fallback declarations for the `node:` built-ins the
  CLI uses (`fs`/`path`/`os`, `__dirname`, `process`; no `child_process` block —
  nothing imports it since the Bun Shell conversion). `@types/node` supersedes it
  in a normal install; it only exists so the project still type-checks
  where `@types/node` can't be fetched. Not dead code — don't delete it.
- `site/` — separate, own `package.json`/`node_modules`, isolated from the CLI's
  `bun install`. A client-side-only browser demo (Vite + CodeMirror 6) deployed to
  GitHub Pages (`https://subho57.github.io/resume-tailor/`) by
  `.github/workflows/deploy-pages.yml`, distinct from `release.yml`. `site/main.ts`
  imports `src/render.ts`/`theme.ts`/`validate.ts`/`types.ts` unmodified — those 4
  files have zero Node/Bun-specific imports, verified deliberately, so the CLI's
  renderer runs unchanged in a browser bundle. Two things the CLI does that the
  browser demo structurally cannot: PDF conversion/`--one-pager` autofit (need
  LibreOffice/Poppler, no server here) and `pack.ts`'s comment-repair step for
  `flagged` highlights (shells out to `unzip`/`zip`) — both are disclosed as known
  limitations in `site/index.html`'s `.limitation-note`, not silently broken.
  `deploy-pages.yml`'s build step only runs `bun install` inside `site/`, so it
  also needs a **root** `bun install` first — `src/render.ts` (a sibling of
  `site/`, not an ancestor) imports `"docx"`, and bundler module resolution only
  walks upward through ancestor `node_modules`, never sideways into a sibling.
  `site/public/install.sh` (the macOS/Linux one-line installer, linked from both
  this repo's README and the Pages site) is a plain static file — Vite's
  `public/` copies it to `dist/` as-is, nothing generates or transforms it.

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

## Master resume + tailoring workflow

Two project skills cover the two ends of this repo's content pipeline:

- `.claude/skills/master-resume-builder/` builds the ground-truth superset itself:
  given a pile of raw material (old resumes, a LinkedIn export, notes, transcripts),
  it extracts every fact, web-searches each named employer and the candidate's own
  public footprint to verify/ground and cross-reference, reconciles disagreements
  across sources via the schema's `flagged`/`note`/`alt` fields (never silently
  picking one), and never invents a value to fill a gap — a vague source fact (e.g.
  an unanchored "last year") stays vague in the output, with the gap stated in a
  note. Writes to `data/<name>.resume.json`.
- `.claude/skills/jd-tailored-resume/` turns a job description into a tailored
  resume from that superset: it reverse-engineers the JD's priorities/keywords,
  selects and rephrases (never fabricates) content from `data/`, writes a new
  tailored content JSON, and renders it through this CLI. By convention, working JD
  text files live in `jds/` and generated tailored `<name>.resume.json` + `.docx` +
  `.pdf` triples live in `output/`, distinct from `data/`'s committed ground truth
  and the default `./out` the bare CLI writes to. Neither `jds/` nor `output/` is
  gitignored — they were historically left untracked by convention, but that's a
  habit, not an enforced rule; whether a given candidate's JD/tailored-output set
  gets committed is a per-case call, not automatic.
