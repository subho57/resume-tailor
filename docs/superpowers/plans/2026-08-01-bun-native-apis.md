# Bun-Native APIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every `node:fs`/`node:child_process` call that has a genuine Bun-native alternative (`Bun.file`/`Bun.write`/Bun Shell `` $`...` ``) with that alternative, add the `node:` protocol prefix to every remaining Node-builtin import, and switch every namespace (`import * as x`) import to named imports of only the functions actually used.

**Architecture:** Two independent conversion units. Unit A is `src/pack.ts` + `src/autofit.ts` + `src/cli.ts`, which must land together because `pack.ts`'s exported functions change from sync to async and every caller needs `await` added in the same change or `tsc` fails. Unit B is `scripts/generate-skill-bundle.ts`, a build-time-only script with zero dependency on Unit A. `src/node-shim.d.ts` (ambient fallback types) is updated first so both units' new `node:`-prefixed imports already have somewhere to resolve if `@types/node` is ever unavailable.

**Tech Stack:** Bun (`Bun.file`, `Bun.write`, `Bun.write`, Bun Shell `import { $ } from "bun"`), TypeScript 7, `node:fs`/`node:path`/`node:os` (named imports only, `node:`-prefixed).

## Global Constraints

- No new automated test suite. This repo has none (`bun test` has nothing to run) and the approved spec explicitly rejects adding one as part of this change. Verification below uses this project's own established method: `bun run build` (type-check) and running the actual CLI/compiled binary and inspecting output — substituting for the "write a failing test" TDD step throughout this plan.
- `path.*` and `os.*` calls, and `fs.mkdirSync`/`chmodSync`/`rmSync`/`mkdtempSync`, have **no** Bun-native alternative and must stay on `node:` imports — do not attempt to convert these; they're the plan's fixed constraint, not an oversight.
- `.quiet()` must be added to **all 5** Bun Shell calls in `pack.ts`, not just the 2 that had `stdio: "ignore"` under `execFileSync` — Bun Shell echoes stdout/stderr to the parent by default, `execFileSync`'s default silently discards it. Missing this is a silent output-leak regression, not a crash.
- Every `Bun.write()`/`Bun.file().text()` call must preserve UTF-8-text-vs-raw-Buffer handling per call site exactly as it is today — see Task 2, Step 1 for the one Buffer case (`packDocx`'s docx bytes).
- Reference spec: `docs/superpowers/specs/2026-08-01-bun-native-apis-design.md` (as corrected — `convertToPdf` also becomes `async`, not only `repairCommentIds`/`countPdfPages`).

---

### Task 1: Update `src/node-shim.d.ts` to match the post-conversion import surface

**Files:**
- Modify: `src/node-shim.d.ts` (full file, shown below)

**Interfaces:**
- Consumes: nothing — this is a leaf ambient-declarations file.
- Produces: ambient module declarations for `"node:fs"`, `"node:path"`, `"node:os"` that Tasks 2 and 3's new `node:`-prefixed named imports resolve against if `@types/node` is ever unavailable (in this dev environment `@types/node` is installed and takes precedence, so this task alone doesn't change `bun run build`'s output — it only matters as the documented fallback).

- [ ] **Step 1: Read the current file to confirm the exact text being replaced**

Run: `cat src/node-shim.d.ts`

Expected output (this is the current, unmodified file):
```ts
// Fallback ambient declarations for the Node built-ins this project uses.
// In a normal install, @types/node (a devDependency) supersedes these with full
// definitions. This shim only exists so the project compiles in environments
// where @types/node cannot be fetched. It declares just what cli/pack/autofit use.

declare module "fs" {
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string | Buffer, encoding?: string): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, opts?: { recursive?: boolean; force?: boolean }): void;
}
declare module "path" {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function basename(p: string, ext?: string): string;
  export function dirname(p: string): string;
}
declare module "os" {
  export function tmpdir(): string;
}
declare module "child_process" {
  export function execFileSync(file: string, args?: string[], opts?: { encoding: string; cwd?: string; stdio?: string }): string;
  export function execFileSync(file: string, args?: string[], opts?: { encoding?: undefined; cwd?: string; stdio?: string }): Buffer;
}

declare const __dirname: string;
declare const process: {
  argv: string[];
  cwd(): string;
  exit(code?: number): never;
  env: Record<string, string | undefined>;
};
declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};
declare class Buffer {}
declare const require: (id: string) => unknown;
declare const module: { exports: unknown };
```

- [ ] **Step 2: Replace the file with the updated module declarations**

Write `src/node-shim.d.ts` with exactly this content:

```ts
// Fallback ambient declarations for the Node built-ins this project uses.
// In a normal install, @types/node (a devDependency) supersedes these with full
// definitions. This shim only exists so the project compiles in environments
// where @types/node cannot be fetched. It declares just what cli/pack/autofit/
// generate-skill-bundle use — all `node:`-prefixed, matching the actual imports
// (readFileSync/writeFileSync/existsSync/execFileSync are gone: those calls were
// converted to Bun.file/Bun.write/Bun Shell, which are typed by @types/bun instead,
// unrelated to @types/node availability).

declare module "node:fs" {
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, opts?: { recursive?: boolean; force?: boolean }): void;
  export function chmodSync(path: string, mode: number): void;
}
declare module "node:path" {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function basename(p: string, ext?: string): string;
  export function dirname(p: string): string;
  export function relative(from: string, to: string): string;
}
declare module "node:os" {
  export function tmpdir(): string;
  export function homedir(): string;
}

declare const __dirname: string;
declare const process: {
  argv: string[];
  cwd(): string;
  exit(code?: number): never;
  env: Record<string, string | undefined>;
  platform: string;
};
declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};
declare class Buffer {}
declare const require: (id: string) => unknown;
declare const module: { exports: unknown };
```

Note: `process.platform` was added to the shim's `process` declaration — it's already used in `cli.ts`'s `pdfToolchainWarning()` today and was simply missing from the shim before this task (a preexisting gap, unrelated to this change's purpose, caught while rewriting this block). `import.meta.dir` (used in `scripts/generate-skill-bundle.ts`) needs no shim entry — it's Bun-specific and typed by `@types/bun`, not `@types/node`.

- [ ] **Step 3: Verify the change doesn't break the build**

Run: `bun run build`
Expected: succeeds exactly as before (`@types/node` is installed in this dev environment and takes precedence over this shim, so this step alone changes nothing observable yet — Tasks 2 and 3 are what actually exercise the new import paths).

- [ ] **Step 4: Commit**

```bash
git add src/node-shim.d.ts
git commit -m "$(cat <<'EOF'
Update node-shim.d.ts for node: prefixed imports

Declares "node:fs"/"node:path"/"node:os" instead of bare module names,
drops the now-unused "child_process" block, and adds chmodSync/homedir/
relative/process.platform — all either newly needed by the upcoming
Bun-native-API conversion or gaps in the shim that predated it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Convert `src/pack.ts`, `src/autofit.ts`, `src/cli.ts` to Bun-native APIs

These three files must change together: `pack.ts`'s `repairCommentIds`, `convertToPdf`, and `countPdfPages` all become `async`, and every caller (in `autofit.ts` and `cli.ts`) needs `await` added in the same commit, or `tsc` fails with type errors (an un-awaited async call assigns a `Promise<T>` where a `T` is expected).

**Files:**
- Modify: `src/pack.ts` (full file)
- Modify: `src/autofit.ts` (full file)
- Modify: `src/cli.ts` (full file)

**Interfaces:**
- Consumes: nothing new — `docx`'s `Packer`/`Document` types, this project's own `./types`/`./validate`/`./theme`/`./render` modules are all unchanged.
- Produces (signatures every caller must now match):
  - `packDocx(doc: Document, outPath: string): Promise<{ commentIdsFixed: number }>` — **unchanged signature**, was already `async`.
  - `checkPdfToolchain(): { soffice: boolean; pdfinfo: boolean }` — **unchanged**, stays sync (uses only `Bun.which`).
  - `convertToPdf(docxPath: string, outDir: string): Promise<string>` — **changed**, was `string` (sync).
  - `countPdfPages(pdfPath: string): Promise<number>` — **changed**, was `number` (sync).

- [ ] **Step 1: Rewrite `src/pack.ts`**

Replace the entire file with:

```ts
import { Packer, Document } from "docx";
import { $ } from "bun";
import { mkdtempSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

// Pack a docx Document to a Buffer. As a safety net against the known v9
// "[object Object]" comment-id serialization bug, we unzip, repair any broken
// comment marker ids in document order, and rezip. With numeric ids this is a
// no-op, but it guarantees valid OOXML regardless of library version.
export async function packDocx(doc: Document, outPath: string): Promise<{ commentIdsFixed: number }> {
  const buf = await Packer.toBuffer(doc);
  await Bun.write(outPath, buf); // buf is a raw docx Buffer, not text — pass through as-is
  const fixed = await repairCommentIds(outPath);
  return { commentIdsFixed: fixed };
}

// Unzip -> fix -> rezip using system unzip/zip (present in the environment).
async function repairCommentIds(docxPath: string): Promise<number> {
  const tmp = mkdtempSync(join(tmpdir(), "docxfix-"));
  try {
    await $`unzip -q ${docxPath} -d ${tmp}`.quiet();
    const docXmlPath = join(tmp, "word", "document.xml");
    if (!(await Bun.file(docXmlPath).exists())) return 0;
    let xml = await Bun.file(docXmlPath).text();
    if (!xml.includes("[object Object]")) return 0; // numeric ids -> nothing to do

    let n = 0;
    xml = xml.replace(/<w:(commentRangeStart|commentRangeEnd|commentReference)\s+w:id="\[object Object\]"(\s*)\/>/g,
      (_m, tag, sp) => { const id = Math.floor(n / 3); n++; return `<w:${tag} w:id="${id}"${sp}/>`; });
    await Bun.write(docXmlPath, xml);

    // rezip: zip contents of tmp back into docxPath
    rmSync(docxPath, { force: true });
    await $`zip -Xrq ${docxPath} .`.cwd(tmp).quiet();
    return Math.floor(n / 3);
  } catch {
    return 0;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Detect presence of the external PDF toolchain (LibreOffice + Poppler) without
// spawning anything, so callers can surface an actionable warning up front instead
// of a vague post-hoc "conversion failed" message. Bun-only (this is a Bun repo).
function binaryExists(bin: string): boolean {
  return !!Bun.which(bin);
}

export function checkPdfToolchain(): { soffice: boolean; pdfinfo: boolean } {
  return { soffice: binaryExists("soffice"), pdfinfo: binaryExists("pdfinfo") };
}

// Convert docx -> pdf via LibreOffice headless. Uses a private profile dir to
// avoid lock contention.
//
// KNOWN ISSUE: under rapid repeated conversions against the same directory (e.g.
// autofit's measure() loop), soffice/pdfinfo can occasionally produce a stably-wrong
// (not flaky/fluctuating) page count for reasons not fully root-caused — deleting any
// pre-existing file at the target path first at least prevents a stale *previous*
// file from being silently re-read as the current result. See autofit.ts's
// DEBUG_AUTOFIT trace and the -1-vs-"fits" handling in its loop for related context;
// this is a pre-existing reliability gap in the pipeline, not something introduced by
// any single caller.
export async function convertToPdf(docxPath: string, outDir: string): Promise<string> {
  const pdfName = basename(docxPath).replace(/\.docx$/i, ".pdf");
  const pdfPath = join(outDir, pdfName);
  rmSync(pdfPath, { force: true });

  const profile = mkdtempSync(join(tmpdir(), "lo-"));
  try {
    await $`soffice --headless -env:UserInstallation=file://${profile} --convert-to pdf:writer_pdf_Export --outdir ${outDir} ${docxPath}`.quiet();
  } catch {
    // fallback to the skill's soffice wrapper path if the direct binary differs
    try {
      await $`python3 /mnt/skills/public/docx/scripts/office/soffice.py --headless --convert-to pdf --outdir ${outDir} ${docxPath}`.quiet();
    } catch { /* leave to caller to detect missing pdf */ }
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  return pdfPath;
}

// Count PDF pages via pdfinfo (Poppler). Returns -1 if it cannot be determined.
export async function countPdfPages(pdfPath: string): Promise<number> {
  if (!(await Bun.file(pdfPath).exists())) return -1;
  try {
    const out = await $`pdfinfo ${pdfPath}`.quiet().text();
    const m = out.match(/Pages:\s+(\d+)/);
    return m ? parseInt(m[1], 10) : -1;
  } catch {
    return -1;
  }
}
```

- [ ] **Step 2: Rewrite `src/autofit.ts`**

Replace the entire file with:

```ts
import { ResumeContent, ResolvedTheme } from "./types";
import { renderResume } from "./render";
import { packDocx, convertToPdf, countPdfPages, checkPdfToolchain } from "./pack";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface AutofitResult {
  fitted: boolean;
  pages: number;
  iterations: number;
  finalTheme: ResolvedTheme;
  warnings: string[];
}

const clone = (t: ResolvedTheme): ResolvedTheme => JSON.parse(JSON.stringify(t));

// Render -> pack -> convert -> count pages. Returns page count (-1 if unmeasurable).
//
// Each call gets its own freshly created temp directory (not just a unique filename
// within one shared directory) — observed in practice, rapid repeated soffice/pdfinfo
// invocations against a churning shared directory produce stably-wrong (not flaky)
// page counts, consistent with the OS/tooling confusing a freshly written file with a
// just-deleted one at the same path or a recently-reused inode. A brand new directory
// per call is the strongest structural isolation available against that class of bug.
async function measure(content: ResumeContent, theme: ResolvedTheme, workRoot: string, keywords: string[]): Promise<number> {
  const work = mkdtempSync(join(workRoot, "m-"));
  try {
    const docxPath = join(work, "probe.docx");
    const { doc } = renderResume(content, theme, keywords);
    await packDocx(doc, docxPath);
    const pdfPath = await convertToPdf(docxPath, work);
    const pages = await countPdfPages(pdfPath);
    if (process.env.DEBUG_AUTOFIT) console.error(`[DEBUG] measure: pdfPath=${pdfPath} exists=${await Bun.file(pdfPath).exists()} pages=${pages} lineHeight=${theme.lineHeight} margins=${theme.margins.top} sizeBody=${theme.sizeBody}`);
    return pages;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Iteratively adjust the theme to fit a single page.
 * Shrink order (cheapest-to-readability first): spacing/line-height -> margins -> body font.
 * Stops at floors (autofit.minBodySize / autofit.minMargin) and warns if still > 1 page.
 */
export async function autofitToSinglePage(content: ResumeContent, startTheme: ResolvedTheme, keywords: string[] = []): Promise<AutofitResult> {
  const warnings: string[] = [];
  let theme = clone(startTheme);
  const af = theme.autofit;
  const work = mkdtempSync(join(tmpdir(), "autofit-"));

  let iterations = 0;
  // -1 means "unmeasurable this attempt" (e.g. a transient conversion hiccup), never
  // "fits" — retrying once before giving up avoids conflating the two, which would
  // otherwise let the loop stop early believing a false "fit to 1 page".
  const measureReliably = async (): Promise<number> => {
    let p = await measure(content, theme, work, keywords);
    iterations++;
    if (p === -1) { p = await measure(content, theme, work, keywords); iterations++; }
    return p;
  };

  try {
    let pages = await measureReliably();
    let giveUp = false;

    if (pages === -1) {
      const toolchain = checkPdfToolchain();
      const missing: string[] = [];
      if (!toolchain.soffice) missing.push("soffice (LibreOffice)");
      if (!toolchain.pdfinfo) missing.push("pdfinfo (Poppler)");
      const detail = missing.length ? `missing: ${missing.join(", ")}` : "conversion failed twice in a row despite both being on PATH";
      warnings.push(`Could not measure page count (${detail}); skipped autofit and kept base theme. See README.md Prerequisites.`);
      return { fitted: false, pages, iterations, finalTheme: theme, warnings };
    }

    while (pages > 1 && iterations < af.maxIterations) {
      let changed = false;

      // Phase 1: spacing / line-height.
      if (theme.lineHeight > 1.0) { theme.lineHeight = Math.max(1.0, +(theme.lineHeight - af.spacingStep).toFixed(3)); changed = true; }
      if (theme.sectionBefore > 6) { theme.sectionBefore = Math.max(6, +(theme.sectionBefore - 0.5).toFixed(2)); changed = true; }
      if (theme.sectionAfter > 2.5) { theme.sectionAfter = Math.max(2.5, +(theme.sectionAfter - 0.25).toFixed(2)); changed = true; }
      if (theme.bulletAfter > 1.5) { theme.bulletAfter = Math.max(1.5, +(theme.bulletAfter - 0.25).toFixed(2)); changed = true; }
      pages = await measureReliably();
      if (pages === -1) { giveUp = true; break; }
      if (pages <= 1) break;

      // Phase 2: margins toward floor.
      (["top", "bottom", "left", "right"] as const).forEach((side) => {
        if (theme.margins[side] > af.minMargin) { theme.margins[side] = Math.max(af.minMargin, +(theme.margins[side] - af.marginStep).toFixed(3)); changed = true; }
      });
      pages = await measureReliably();
      if (pages === -1) { giveUp = true; break; }
      if (pages <= 1) break;

      // Phase 3: body font (proportional derived sizes) toward floor.
      if (theme.sizeBody > af.minBodySize) {
        const newBody = Math.max(af.minBodySize, +(theme.sizeBody - af.fontStep).toFixed(2));
        const ratio = newBody / theme.sizeBody;
        theme.sizeBody = newBody;
        theme.baseSize = +(theme.baseSize * ratio).toFixed(2);
        theme.sizeSmall = Math.max(8, +(theme.sizeSmall * ratio).toFixed(2));
        theme.sizeSectionHeading = Math.max(10, +(theme.sizeSectionHeading * ratio).toFixed(2));
        theme.sizeName = Math.max(14, +(theme.sizeName * ratio).toFixed(2)); // name floor 14pt
        changed = true;
      }
      pages = await measureReliably();
      if (pages === -1) { giveUp = true; break; }

      const atFloors = theme.sizeBody <= af.minBodySize &&
        theme.margins.top <= af.minMargin && theme.margins.bottom <= af.minMargin &&
        theme.margins.left <= af.minMargin && theme.margins.right <= af.minMargin &&
        theme.lineHeight <= 1.0;
      if (!changed || (atFloors && pages > 1)) break;
    }

    if (giveUp) {
      warnings.push("Page-count measurement failed twice in a row mid-autofit (LibreOffice/pdfinfo hiccup); stopped shrinking with the last verified theme rather than guessing.");
    }
    const fitted = !giveUp && pages === 1;
    if (!fitted && !giveUp) {
      warnings.push(`Could not fit one page at readable floors (body ${theme.sizeBody}pt, margins ${theme.margins.top}in, line-height ${theme.lineHeight}). Result is ${pages} page(s). Consider trimming content rather than shrinking further.`);
    }
    return { fitted, pages, iterations, finalTheme: theme, warnings };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
```

- [ ] **Step 3: Rewrite `src/cli.ts`**

Replace the entire file with:

```ts
#!/usr/bin/env bun
// ============================================================================
// Resume builder CLI.
//
// Usage:
//   resume-build --content <file.json> [options]
//
// Options:
//   --content <path>            Resume content JSON (required).
//   --theme <path|name>         Theme preset: a .json path, or a name resolved to
//                               themes/<name>.theme.json. Overrides content.theme.
//   --out <dir>                 Output directory (default: ./out).
//   --basename <name>           Output file base name (default: derived from name).
//   --one-pager                 Iteratively shrink spacing/margins/font (within
//                               ATS-safe floors) to fit one page; warns if it can't.
//   --no-pdf                    Skip PDF generation (docx only).
//   --keywords <comma,list>     Bold these terms wherever they appear in the Summary,
//                               Work-experience bullets, and Projects (case-insensitive,
//                               whole-term matching). Not stored in content/theme JSON —
//                               a render-time-only directive.
//   --schema <path>             Content schema (default: schema/resume.schema.json).
//   --theme-schema <path>       Theme schema (default: schema/theme.schema.json).
//   --strict                    Exit non-zero if any validation warnings occur.
//   --quiet                     Suppress warning output.
//   --version, -v               Print the version and exit.
//   --install-skill [name]      Install standalone skill(s) to BOTH
//                               ~/.claude/skills/<name>/ and ~/.copilot/skills/<name>/
//                               (standalone variant — invokes this binary directly,
//                               no repo). Omit <name> to install every bundled
//                               skill; see --help for the list of names.
//
// Behavior: validation is BEST-EFFORT — warnings are printed, defaults applied,
// obvious type mismatches coerced, and the resume is rendered from whatever
// content is present. It never hard-fails on content problems (unless --strict).
// ============================================================================

import { chmodSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { ResumeContent, Theme } from "./types";
import { validate, Warning, JsonSchema } from "./validate";
import { resolveTheme } from "./theme";
import { renderResume } from "./render";
import { packDocx, convertToPdf, countPdfPages, checkPdfToolchain } from "./pack";
import { autofitToSinglePage } from "./autofit";

// Statically imported (not read from disk) so `bun build --compile` embeds these
// directly into a standalone binary, where __dirname resolves to Bun's virtual
// filesystem rather than a real directory containing schema/themes/. `bun dist/cli.js`
// still reads the live files off disk first (see the Bun.file() existence checks
// below) — these are only the fallback for when that fails, i.e. inside the
// compiled binary.
import resumeSchemaBuiltin from "../schema/resume.schema.json";
import themeSchemaBuiltin from "../schema/theme.schema.json";
import corporateNavyBuiltin from "../themes/corporate-navy.theme.json";
import slateCompactBuiltin from "../themes/slate-compact.theme.json";
import pkg from "../package.json";
// Generated by scripts/generate-skill-bundle.ts (run automatically by `bun run
// build`/`bun run compile`) — every bundled skill's files, keyed by skill name, with
// each SKILL.md's repo/bun-specific instructions rewritten to invoke this binary
// directly. Not committed (gitignored); regenerate with `bun run prepare-skill` if
// missing.
import { SKILL_BUNDLES } from "./skill-bundle.generated";

// Bare `--theme <name>` resolves here first, before the fs-based lookup below.
// Adding a new theme preset needs a line here (+ a recompile) to be embedded.
const BUILTIN_THEMES: Record<string, Theme> = {
  "corporate-navy": corporateNavyBuiltin as Theme,
  "slate-compact": slateCompactBuiltin as Theme,
};

// Build an actionable "missing binary + how to install it" message, or null if
// the full PDF toolchain (LibreOffice + Poppler) is present.
function pdfToolchainWarning(toolchain: { soffice: boolean; pdfinfo: boolean }): string | null {
  const missing: string[] = [];
  if (!toolchain.soffice) missing.push("soffice (LibreOffice)");
  if (!toolchain.pdfinfo) missing.push("pdfinfo (Poppler)");
  if (!missing.length) return null;
  const hint = process.platform === "darwin"
    ? "brew install --cask libreoffice && brew install poppler"
    : process.platform === "linux"
    ? "sudo apt install libreoffice poppler-utils"
    : "see README.md Prerequisites section for install instructions";
  return `Missing ${missing.join(" and ")} on PATH — PDF output and autofit are skipped. Install: ${hint}`;
}

interface Args {
  content?: string; theme?: string; out: string; basename?: string;
  autofit: boolean; pdf: boolean; keywords: string[]; schema: string; themeSchema: string;
  strict: boolean; quiet: boolean;
}

async function parseArgs(argv: string[]): Promise<Args> {
  const here = __dirname;
  const root = resolve(here, "..");
  const a: Args = {
    out: resolve(process.cwd(), "out"),
    autofit: false, pdf: true, keywords: [],
    schema: join(root, "schema", "resume.schema.json"),
    themeSchema: join(root, "schema", "theme.schema.json"),
    strict: false, quiet: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--content": a.content = next(); break;
      case "--theme": a.theme = next(); break;
      case "--out": a.out = resolve(next()); break;
      case "--basename": a.basename = next(); break;
      case "--one-pager": a.autofit = true; break;
      case "--no-pdf": a.pdf = false; break;
      case "--keywords": a.keywords = next().split(",").map((k) => k.trim()).filter(Boolean); break;
      case "--schema": a.schema = next(); break;
      case "--theme-schema": a.themeSchema = next(); break;
      case "--strict": a.strict = true; break;
      case "--quiet": a.quiet = true; break;
      case "-h": case "--help": printHelp(); process.exit(0); break;
      case "-v": case "--version": console.log(pkg.version); process.exit(0); break;
      case "--install-skill": {
        const peeked = argv[i + 1];
        const name = peeked && !peeked.startsWith("-") ? argv[++i] : undefined;
        await installSkill(name);
        process.exit(0);
        break;
      }
      default: console.error(`Unknown option: ${arg}`); printHelp(); process.exit(2); break;
    }
  }
  return a;
}

function printHelp() {
  console.log(`resume-build --content <file.json> [--theme <name|path>] [--out <dir>]
                   [--basename <name>] [--one-pager] [--no-pdf]
                   [--keywords <comma,list>] [--strict] [--quiet] [--version]
                   [--install-skill [name]]

Bundled skills (for --install-skill): ${Object.keys(SKILL_BUNDLES).join(", ")}`);
}

// Writes the embedded standalone variant of one (or every) bundled skill — invokes
// this binary directly, no repo — to both ~/.claude/skills/<name>/ and
// ~/.copilot/skills/<name>/, so either assistant picks it up. Always overwrites:
// re-running --install-skill is the update mechanism, no repo/build step, matches
// this CLI's non-interactive style elsewhere.
const SKILL_HOME_DIRS: Record<"claude" | "copilot", string> = {
  claude: ".claude",
  copilot: ".copilot",
};

async function installSkill(name?: string) {
  if (name && !(name in SKILL_BUNDLES)) {
    console.error(`Unknown skill: ${name}. Available: ${Object.keys(SKILL_BUNDLES).join(", ")}`);
    process.exit(2);
  }
  const names = name ? [name] : Object.keys(SKILL_BUNDLES);
  for (const skillName of names) {
    for (const [target, homeDir] of Object.entries(SKILL_HOME_DIRS) as [keyof typeof SKILL_HOME_DIRS, string][]) {
      const dest = join(homedir(), homeDir, "skills", skillName);
      const bundle = SKILL_BUNDLES[skillName][target];
      for (const [relPath, content] of Object.entries(bundle)) {
        const full = join(dest, relPath);
        mkdirSync(dirname(full), { recursive: true });
        await Bun.write(full, content);
        if (relPath.endsWith(".py")) chmodSync(full, 0o755);
      }
      console.log(`✓ Installed ${skillName} skill (standalone variant — uses build-resume directly, no repo) to:`);
      console.log(`  ${dest}`);
      console.log(`  Files: ${Object.keys(bundle).join(", ")}`);
    }
  }
}

async function readJson<T = unknown>(p: string): Promise<T> {
  return JSON.parse(await Bun.file(p).text()) as T;
}

async function resolveThemePath(themeArg: string | undefined, contentTheme: string | undefined, root: string): Promise<string | undefined> {
  const name = themeArg || contentTheme;
  if (!name) return undefined;
  if (name.endsWith(".json") && await Bun.file(name).exists()) return name;
  const byName = join(root, "themes", `${name}.theme.json`);
  if (await Bun.file(byName).exists()) return byName;
  if (await Bun.file(name).exists()) return name;
  return undefined;
}

function printWarnings(label: string, warnings: Warning[] | string[], quiet: boolean) {
  if (quiet || !warnings.length) return;
  console.warn(`\n⚠  ${label} (${warnings.length}):`);
  for (const w of warnings) {
    if (typeof w === "string") console.warn(`   - ${w}`);
    else console.warn(`   - ${w.path}: ${w.message}`);
  }
}

async function main() {
  const args = await parseArgs(process.argv);
  const root = resolve(__dirname, "..");

  if (!args.content) { console.error("Error: --content <file.json> is required."); printHelp(); process.exit(2); }
  if (!(await Bun.file(args.content).exists())) { console.error(`Error: content file not found: ${args.content}`); process.exit(2); }

  // --- load + validate content (best-effort) ---
  const content = await readJson<ResumeContent>(args.content);
  const contentSchema = await Bun.file(args.schema).exists() ? await readJson<JsonSchema>(args.schema) : resumeSchemaBuiltin;
  let contentWarnings: Warning[] = validate(contentSchema, content);
  printWarnings("Content validation warnings", contentWarnings, args.quiet);

  // --- load + validate theme (best-effort) ---
  // A bare theme name checks the embedded BUILTIN_THEMES first (works with no
  // filesystem access, e.g. inside a compiled binary); only names outside that map,
  // or an explicit --theme <path.json>, fall through to the fs-based lookup.
  const themeName = args.theme || content.theme;
  let themeRaw: Theme = {};
  let themeSource: string | undefined;
  if (themeName && BUILTIN_THEMES[themeName]) {
    themeRaw = BUILTIN_THEMES[themeName];
    themeSource = `${themeName} (built-in)`;
  } else {
    const themePath = await resolveThemePath(args.theme, content.theme, root);
    if (themePath) {
      themeRaw = await readJson<Theme>(themePath);
      themeSource = basename(themePath);
    } else if (themeName) {
      console.warn(`⚠  Theme "${themeName}" not found; using built-in defaults.`);
    }
  }
  if (themeSource) {
    const themeSchema = await Bun.file(args.themeSchema).exists() ? await readJson<JsonSchema>(args.themeSchema) : themeSchemaBuiltin;
    const themeWarnings = validate(themeSchema, themeRaw);
    printWarnings(`Theme validation warnings (${themeSource})`, themeWarnings, args.quiet);
    contentWarnings = contentWarnings.concat(themeWarnings);
  }
  const theme = resolveTheme(themeRaw);

  // --- output paths ---
  mkdirSync(args.out, { recursive: true });
  const base = args.basename || sanitize(content.basics?.name || "resume");
  const docxPath = join(args.out, `${base}.docx`);
  const runtimeWarnings: string[] = [];

  // --- PDF toolchain preflight (surface missing binaries up front, not just after a failed convert) ---
  const toolchain = (args.pdf || args.autofit) ? checkPdfToolchain() : { soffice: true, pdfinfo: true };
  const toolchainWarning = pdfToolchainWarning(toolchain);
  if (toolchainWarning && (args.pdf || args.autofit)) runtimeWarnings.push(toolchainWarning);

  // --- autofit (optional) ---
  let finalTheme = theme;
  if (args.autofit) {
    if (!args.pdf) {
      runtimeWarnings.push("--one-pager requires PDF rendering to measure pages; ignoring --no-pdf for measurement.");
    }
    const result = await autofitToSinglePage(content, theme, args.keywords);
    finalTheme = result.finalTheme;
    runtimeWarnings.push(...result.warnings);
    if (!args.quiet) {
      console.log(`\n▸ Autofit: ${result.fitted ? "fit to 1 page" : `stopped at ${result.pages} page(s)`} after ${result.iterations} iteration(s).`);
      console.log(`  final: body ${finalTheme.sizeBody}pt · margins ${finalTheme.margins.top}in · line-height ${finalTheme.lineHeight}`);
    }
  }

  // --- render + pack final docx ---
  const { doc, commentCount } = renderResume(content, finalTheme, args.keywords);
  const { commentIdsFixed } = await packDocx(doc, docxPath);
  if (!args.quiet) {
    console.log(`\n✓ DOCX: ${docxPath}`);
    if (commentCount) console.log(`  ${commentCount} flag comment(s)${commentIdsFixed ? `; repaired ${commentIdsFixed} marker id(s)` : ""}.`);
  }

  // --- pdf ---
  if (args.pdf) {
    const pdfPath = await convertToPdf(docxPath, args.out);
    const pages = await countPdfPages(pdfPath);
    if (await Bun.file(pdfPath).exists()) {
      if (!args.quiet) console.log(`✓ PDF:  ${pdfPath}${pages > 0 ? `  (${pages} page${pages === 1 ? "" : "s"})` : ""}`);
    } else if (!toolchainWarning) {
      // Toolchain looked present but conversion still failed — a different problem than a missing binary.
      runtimeWarnings.push("PDF conversion failed despite soffice/pdfinfo being on PATH; DOCX was still written. Check LibreOffice logs.");
    }
  }

  printWarnings("Runtime warnings", runtimeWarnings, args.quiet);

  const totalWarnings = contentWarnings.length + runtimeWarnings.length;
  if (args.strict && totalWarnings > 0) {
    console.error(`\n✗ --strict: ${totalWarnings} warning(s); exiting non-zero.`);
    process.exit(1);
  }
}

function sanitize(s: string): string {
  return s.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "resume";
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
```

- [ ] **Step 4: Type-check the whole change**

Run: `bun run build`
Expected: `✓ Generated src/skill-bundle.generated.ts (2 skills, 10 files total: jd-tailored-resume, master-resume-builder)` printed, then `tsc -p tsconfig.json` exits 0 with no errors. If you see an error like `Type 'Promise<string>' is not assignable to type 'string'`, it means a caller of `convertToPdf`/`countPdfPages`/`readJson`/`resolveThemePath` is still missing an `await` — search that exact function name in `src/cli.ts` and `src/autofit.ts` for a call site without `await` in front of it.

- [ ] **Step 5: Functional regression check against the known-good baseline**

Run:
```bash
bun dist/cli.js --content data/priyanka.resume.json --out /tmp/bun-native-check
```
Expected output includes exactly:
```
✓ DOCX: /tmp/bun-native-check/Priyanka_Chatterjee.docx
  5 flag comment(s).
✓ PDF:  /tmp/bun-native-check/Priyanka_Chatterjee.pdf  (8 pages)
```
This is the same input this repo's own validation loop already used pre-change (verified earlier this session) — `5 flag comment(s)` and `(8 pages)` must match exactly. A different comment count or page count means `repairCommentIds`, `convertToPdf`, or `countPdfPages` behaves differently than before, not just "didn't crash."

- [ ] **Step 6: One-pager (autofit) regression check**

Run:
```bash
bun dist/cli.js --content data/tailored-golang.example.json --out /tmp/bun-native-check --one-pager
```
Expected: exits 0, prints a `▸ Autofit: fit to 1 page after N iteration(s).` line followed by `✓ DOCX:` and `✓ PDF:  ...  (1 page)`. This exercises `autofit.ts`'s `measure()`/`measureReliably()` loop — the part of this change most likely to reveal an ordering bug from the sync-to-async conversion, since it calls `packDocx`/`convertToPdf`/`countPdfPages` repeatedly in a loop.

- [ ] **Step 7: `--install-skill` regression check (exercises the newly-async `installSkill`/`parseArgs`)**

Run:
```bash
rm -rf /tmp/bun-native-fake-home
HOME=/tmp/bun-native-fake-home bun dist/cli.js --install-skill master-resume-builder
find /tmp/bun-native-fake-home -type f | sort
```
Expected: prints two `✓ Installed master-resume-builder skill ...` blocks (one for `~/.claude/skills/...`, one for `~/.copilot/skills/...`), and `find` lists exactly:
```
/tmp/bun-native-fake-home/.claude/skills/master-resume-builder/SKILL.md
/tmp/bun-native-fake-home/.claude/skills/master-resume-builder/references/research-guide.md
/tmp/bun-native-fake-home/.copilot/skills/master-resume-builder/SKILL.md
/tmp/bun-native-fake-home/.copilot/skills/master-resume-builder/references/research-guide.md
```

- [ ] **Step 8: Compiled-binary smoke test**

Run:
```bash
bun run compile
./bin/build-resume --content data/priyanka.resume.json --out /tmp/bun-native-check-compiled
```
Expected: `bun run compile` exits 0 (prints `[compile] bin/build-resume`), and the compiled binary's output matches Step 5 exactly (`5 flag comment(s).` and `(8 pages)`). This specifically confirms `Bun.file`/`Bun.write` resolve against the **real** filesystem inside the compiled binary for user-supplied paths, not Bun's virtual embedded one — the gotcha `CLAUDE.md` already documents for this binary's schema/theme resource loading.

- [ ] **Step 9: Commit**

```bash
git add src/pack.ts src/autofit.ts src/cli.ts
git commit -m "$(cat <<'EOF'
Convert pack.ts/autofit.ts/cli.ts to Bun-native fs/subprocess APIs

fs.readFileSync/writeFileSync/existsSync -> Bun.file/Bun.write;
execFileSync -> Bun Shell $ (with .quiet() on all 5 calls to match
execFileSync's silent-by-default output, and .cwd()/.text() where
needed). convertToPdf/repairCommentIds/countPdfPages become async;
callers in autofit.ts and cli.ts updated with await. Remaining
fs.mkdirSync/chmodSync/rmSync/mkdtempSync and all path.*/os.* stay on
node: (no Bun alternative exists), now node:-prefixed and named-import
only instead of namespace imports.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Convert `scripts/generate-skill-bundle.ts` to Bun-native APIs

Independent of Task 2 — this script never imports from `pack.ts`/`autofit.ts`/`cli.ts`, and its output shape (`SKILL_BUNDLES`'s `Record<string, Record<"claude"|"copilot", Record<string,string>>>`) is unchanged, so `cli.ts` doesn't need to change again here.

**Files:**
- Modify: `scripts/generate-skill-bundle.ts` (only the imports and `main()`; `assertReplace`, `transformJdTailoredResumeSkillMd`, `transformMasterResumeBuilderSkillMd`, `deriveCopilotSkillMd`, `SkillSpec`, `SKILLS` are pure string manipulation with zero `fs`/`path` calls and stay **completely unchanged** — do not touch them)

**Interfaces:**
- Consumes: nothing from Task 2.
- Produces: `src/skill-bundle.generated.ts` — same shape as before (`SKILL_BUNDLES: Record<string, Record<"claude" | "copilot", Record<string, string>>>`), byte-identical content, only the I/O mechanism generating it changed.

- [ ] **Step 1: Replace the import lines**

Find in `scripts/generate-skill-bundle.ts`:
```ts
import * as fs from "fs";
import * as path from "path";
```
Replace with:
```ts
import { mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
```

- [ ] **Step 2: Rename `path.resolve`/`path.join` in the two top-level constants**

Find:
```ts
const repoRoot = path.resolve(import.meta.dir, "..");
const outPath = path.join(repoRoot, "src", "skill-bundle.generated.ts");
```
Replace with:
```ts
const repoRoot = resolve(import.meta.dir, "..");
const outPath = join(repoRoot, "src", "skill-bundle.generated.ts");
```

- [ ] **Step 3: Rewrite `main()`**

Find the entire `main()` function:
```ts
function main() {
  // bundles[skillName][target][relPath] = content
  const bundles: Record<string, Record<"claude" | "copilot", Record<string, string>>> = {};

  for (const skill of SKILLS) {
    const skillDir = path.join(repoRoot, ".claude", "skills", skill.name);
    const skillMdRaw = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
    const extraFiles: Record<string, string> = {};
    for (const rel of skill.extraFiles) {
      extraFiles[rel] = fs.readFileSync(path.join(skillDir, rel), "utf-8");
    }

    const claudeSkillMd = skill.transformSkillMd(skillMdRaw);
    bundles[skill.name] = {
      claude: { "SKILL.md": claudeSkillMd, ...extraFiles },
      copilot: { "SKILL.md": deriveCopilotSkillMd(skill.name, claudeSkillMd), ...extraFiles },
    };
  }

  // 1. Embed both targets' bundles into the CLI for `build-resume --install-skill`
  //    (personal-skill install, no repo needed).
  const entries = Object.entries(bundles)
    .map(([skillName, targets]) => {
      const targetEntries = Object.entries(targets)
        .map(([target, bundle]) => {
          const fileEntries = Object.entries(bundle)
            .map(([rel, content]) => `      ${JSON.stringify(rel)}: ${JSON.stringify(content)},`)
            .join("\n");
          return `    ${JSON.stringify(target)}: {\n${fileEntries}\n    },`;
        })
        .join("\n");
      return `  ${JSON.stringify(skillName)}: {\n${targetEntries}\n  },`;
    })
    .join("\n");

  const output = `// AUTO-GENERATED by scripts/generate-skill-bundle.ts — do not edit by hand.\n` +
    `// Regenerated by \`bun run prepare-skill\` (also run automatically by the build/compile scripts).\n` +
    `export const SKILL_BUNDLES: Record<string, Record<"claude" | "copilot", Record<string, string>>> = {\n${entries}\n};\n`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output, "utf-8");

  // No repo-committed `.copilot/skills/` mirror: Copilot CLI's own project-skill
  // discovery already falls back to `.claude/skills/` (see the comment on
  // deriveCopilotSkillMd above), so writing one here would just be an unread
  // duplicate on disk, not a functional install target.

  const skillNames = Object.keys(bundles);
  const fileCount = Object.values(bundles).reduce(
    (n, targets) => n + Object.values(targets).reduce((m, b) => m + Object.keys(b).length, 0),
    0
  );
  console.log(`✓ Generated ${path.relative(repoRoot, outPath)} (${skillNames.length} skills, ${fileCount} files total: ${skillNames.join(", ")})`);
}

main();
```
Replace it with:
```ts
async function main() {
  // bundles[skillName][target][relPath] = content
  const bundles: Record<string, Record<"claude" | "copilot", Record<string, string>>> = {};

  for (const skill of SKILLS) {
    const skillDir = join(repoRoot, ".claude", "skills", skill.name);
    const skillMdRaw = await Bun.file(join(skillDir, "SKILL.md")).text();
    const extraFiles: Record<string, string> = {};
    for (const rel of skill.extraFiles) {
      extraFiles[rel] = await Bun.file(join(skillDir, rel)).text();
    }

    const claudeSkillMd = skill.transformSkillMd(skillMdRaw);
    bundles[skill.name] = {
      claude: { "SKILL.md": claudeSkillMd, ...extraFiles },
      copilot: { "SKILL.md": deriveCopilotSkillMd(skill.name, claudeSkillMd), ...extraFiles },
    };
  }

  // 1. Embed both targets' bundles into the CLI for `build-resume --install-skill`
  //    (personal-skill install, no repo needed).
  const entries = Object.entries(bundles)
    .map(([skillName, targets]) => {
      const targetEntries = Object.entries(targets)
        .map(([target, bundle]) => {
          const fileEntries = Object.entries(bundle)
            .map(([rel, content]) => `      ${JSON.stringify(rel)}: ${JSON.stringify(content)},`)
            .join("\n");
          return `    ${JSON.stringify(target)}: {\n${fileEntries}\n    },`;
        })
        .join("\n");
      return `  ${JSON.stringify(skillName)}: {\n${targetEntries}\n  },`;
    })
    .join("\n");

  const output = `// AUTO-GENERATED by scripts/generate-skill-bundle.ts — do not edit by hand.\n` +
    `// Regenerated by \`bun run prepare-skill\` (also run automatically by the build/compile scripts).\n` +
    `export const SKILL_BUNDLES: Record<string, Record<"claude" | "copilot", Record<string, string>>> = {\n${entries}\n};\n`;

  mkdirSync(dirname(outPath), { recursive: true });
  await Bun.write(outPath, output);

  // No repo-committed `.copilot/skills/` mirror: Copilot CLI's own project-skill
  // discovery already falls back to `.claude/skills/` (see the comment on
  // deriveCopilotSkillMd above), so writing one here would just be an unread
  // duplicate on disk, not a functional install target.

  const skillNames = Object.keys(bundles);
  const fileCount = Object.values(bundles).reduce(
    (n, targets) => n + Object.values(targets).reduce((m, b) => m + Object.keys(b).length, 0),
    0
  );
  console.log(`✓ Generated ${relative(repoRoot, outPath)} (${skillNames.length} skills, ${fileCount} files total: ${skillNames.join(", ")})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Byte-identical output regression check**

Run:
```bash
cp src/skill-bundle.generated.ts /tmp/skill-bundle.before.ts
bun run prepare-skill
diff /tmp/skill-bundle.before.ts src/skill-bundle.generated.ts
```
Expected: `diff` prints nothing (no output = identical). This confirms only the I/O mechanism changed, not the generated content — since `src/skill-bundle.generated.ts` is gitignored, this before/after copy is the only way to check it didn't change.

- [ ] **Step 5: Full build still passes**

Run: `bun run build`
Expected: exits 0, same `✓ Generated ...` line as always.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-skill-bundle.ts
git commit -m "$(cat <<'EOF'
Convert generate-skill-bundle.ts to Bun-native fs APIs

fs.readFileSync/writeFileSync -> Bun.file/Bun.write; main() becomes
async, invoked as main().catch(...) instead of a bare call. Named,
node:-prefixed imports replace the namespace fs/path imports.
Verified byte-identical generated output before/after.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Full verification pass

Runs the spec's complete testing plan end-to-end now that every file is converted, including the two checks that only make sense with everything in place together.

**Files:** none (verification only, no code changes)

**Interfaces:** none

- [ ] **Step 1: Confirm final `git status` is clean except for the expected commits**

Run: `git log --oneline -5 && git status --short`
Expected: the 3 commits from Tasks 1–3 (plus the 2 spec commits from before) appear in the log; `git status --short` shows only pre-existing untracked files unrelated to this change (`data/Aritrika_Karmakar_CV (2).pdf`, `data/run-*.json` — confirmed present before this work started, not touched by it).

- [ ] **Step 2: Full ground-truth render (multi-page, no autofit)**

Run: `bun dist/cli.js --content data/priyanka.resume.json --out /tmp/bun-native-final`
Expected: same as Task 2 Step 5 — `5 flag comment(s).` and `(8 pages)`.

- [ ] **Step 3: Tailored one-pager render (exercises the autofit loop)**

Run: `bun dist/cli.js --content data/tailored-golang.example.json --out /tmp/bun-native-final --one-pager`
Expected: same as Task 2 Step 6 — `▸ Autofit: fit to 1 page after N iteration(s).` and a `(1 page)` PDF.

- [ ] **Step 4: `checkPdfToolchain()` regression check (unaffected logic, same file)**

Run: `bun -e 'import { checkPdfToolchain } from "./src/pack.ts"; console.log(checkPdfToolchain());'`
Expected: `{ soffice: true, pdfinfo: true }` (or matching whatever this machine's actual LibreOffice/Poppler install state is — the point is it still runs and returns a well-formed object, not that both are necessarily `true` on every machine).

- [ ] **Step 5: Re-run the documented flakiness scenario at least once**

Run: `DEBUG_AUTOFIT=1 bun dist/cli.js --content data/tailored-golang.example.json --out /tmp/bun-native-final --one-pager 2>&1 | grep DEBUG`
Expected: prints one `[DEBUG] measure: pdfPath=... exists=true pages=N ...` line per autofit iteration, all with `exists=true` and a plausible (not `-1`, not wildly inconsistent) `pages` value. This isn't a pass/fail gate for the pre-existing known bug (`CLAUDE.md` already documents it as unresolved) — it's confirming this change didn't make it worse.

- [ ] **Step 6: Windows-target compile still succeeds (can't run it, but confirm it cross-compiles clean)**

Run: `bun build --compile --target=bun-windows-x64 --outfile=/tmp/build-resume-windows-test.exe ./src/cli.ts`
Expected: exits 0, produces the `.exe` file. This doesn't execute the Windows binary (can't, on this machine) — it only confirms Bun Shell's `$` and `Bun.file`/`Bun.write` don't fail to even *compile* for the Windows target, which is the one thing checkable here. The spec's "known unverifiable-in-CI gap" about actually *running* Bun Shell on Windows stands as documented, unresolved by this step.

- [ ] **Step 7: Report final status**

Summarize in the session: all 4 tasks committed, byte-identical `skill-bundle.generated.ts`, matching page counts before/after, compiled binary confirmed working with real (non-embedded) file paths, and the one open, documented, unverifiable-in-this-repo's-CI risk (Bun Shell actually running on Windows).
