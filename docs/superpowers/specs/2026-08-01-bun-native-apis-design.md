# Bun-native APIs: replace convertible `node:` builtin calls

Date: 2026-08-01

## Overview

This repo currently uses `node:fs`/`node:path`/`node:os`/`node:child_process`
throughout (`Bun.which` is the sole existing exception, used for PATH binary
detection). This design converts every call that has a genuine Bun-native
alternative to that alternative, while leaving everything else on `node:` —
because most of the `fs` surface used here, and all of `path`/`os`, have **no**
Bun-native equivalent at all. It also removes `node:`-unprefixed bare-specifier
imports and namespace (`import * as x`) imports in favor of `node:`-prefixed,
named-only imports, since every touched file's import lines are being edited
anyway.

## What has a Bun alternative (verified against installed `bun-types@1.3.14`, not assumed)

| Currently used | Bun-native alternative | Notes |
|---|---|---|
| `fs.readFileSync` | `Bun.file(path).text()` | Async-only; throws `ENOENT` on missing file, verified empirically — same shape as `fs.readFileSync` |
| `fs.writeFileSync` | `Bun.write(path, data)` | Async-only. Accepts `Buffer` directly (verified against `BunFile.write`'s signature) — matters because `packDocx`'s `fs.writeFileSync(outPath, buf)` writes the raw docx `Buffer` from `Packer.toBuffer()`, unlike every other read/write call in this codebase, which is UTF-8 text. No special handling needed either way — pass the `Buffer` through as-is, don't route it through `.text()`. |
| `fs.existsSync` | `Bun.file(path).exists()` | Async-only |
| `child_process.execFileSync` | Bun Shell `` $`...` `` | Throws `ShellError` on nonzero exit by default (`shell.d.ts`) — matches `execFileSync`'s current throw-on-failure behavior. Auto-escapes template-interpolated values. |

## What has NO Bun alternative — stays on `node:`, not a choice

- `fs.mkdirSync`, `fs.chmodSync`, `fs.rmSync`, `fs.mkdtempSync` — Bun has no
  directory/permission/removal API of its own.
- `path.*` entirely (`join`/`resolve`/`dirname`/`basename`/`relative`) — Bun
  re-exports `node:path` verbatim, never reimplements it.
- `os.*` entirely (`homedir`/`tmpdir`) — same story as `path`.

Checked `BunFile` (`Bun.file()`'s return type) directly: it extends `Blob`, and
every read/write method (`text()`, `exists()`, `write()`, `unlink()`, `delete()`,
`stat()`) is `Promise`-returning — no sync variant exists anywhere in the chain.
Checked `import {...} from "bun"`: `bun.ns.d.ts` is literally `export import Bun =
BunModule` — the module form and the global `Bun` namespace are the same object,
nothing hides under one that isn't in the other.

## Scope

**In scope:**
- Every `fs.readFileSync`/`writeFileSync`/`existsSync` → `Bun.file()`/`Bun.write()`
  (`src/cli.ts`, `src/pack.ts`, `src/autofit.ts`'s one `DEBUG_AUTOFIT` line,
  `scripts/generate-skill-bundle.ts`).
- `src/pack.ts`'s 5 `execFileSync` calls (`unzip`, `zip`, `soffice`, `python3`
  fallback, `pdfinfo`) → Bun Shell `` $`...` `` calls.
- `scripts/generate-skill-bundle.ts` is included despite being build-time-only
  tooling not shipped in the compiled binary — explicitly confirmed with the user
  rather than assumed, for full-codebase consistency over the narrower "only the
  runtime CLI" option.
- Every remaining Node-builtin import gets the `node:` protocol prefix.
- Every `import * as x from "..."` namespace import becomes a named import of
  only the specific functions actually called in that file.
- `src/node-shim.d.ts` updated to match (`"node:fs"`/`"node:path"`/`"node:os"`
  module declarations instead of bare names; `"child_process"` block deleted —
  nothing imports it anymore).

**Out of scope / explicitly rejected:**
- Converting `fs.mkdirSync`/`chmodSync`/`rmSync`/`mkdtempSync` or any `path`/`os`
  call — no Bun alternative exists (see table above).
- A thin `src/bun-fs.ts` wrapper module centralizing the Bun calls — considered
  and rejected as premature abstraction for ~10 call sites, against this
  codebase's own stated conventions.
- `Bun.spawnSync` for the subprocess layer — considered, but Bun Shell was chosen
  instead: it throws by default (matching `execFileSync`'s current behavior with
  less boilerplate than `spawnSync`'s manual `if (!success) throw`) and
  auto-escapes interpolated paths (relevant: this repo's own `data/` directory
  already contains a filename with a space and parens).
- Adding a new automated test suite — repo has none today (`bun test` has nothing
  to run); this is a mechanical refactor, not a place to introduce test
  infrastructure as a side effect.

## Component-by-component changes

### `src/cli.ts`
```ts
import { chmodSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
```
- `readJson`, `resolveThemePath`, `installSkill`, `parseArgs` gain `async`.
- Their `fs.readFileSync`/`writeFileSync`/`existsSync` calls become
  `Bun.file()`/`Bun.write()`.
- `main()` (already `async`) adds `await` at each now-async call site — no
  propagation beyond `main()`, since it's already the top of the call chain.
- Every remaining `fs.X`/`path.X`/`os.X` call site renames to the bare imported
  identifier (e.g. `fs.mkdirSync(...)` → `mkdirSync(...)`).

### `src/pack.ts`
```ts
import { mkdtempSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { $ } from "bun";
```
- `child_process` import removed entirely.
- `packDocx`'s `fs.writeFileSync(outPath, buf)` → `Bun.write(outPath, buf)` — `buf`
  is the raw docx `Buffer` from `Packer.toBuffer()`, not text; pass it through
  unchanged (see table above). Every other read/write in this file is UTF-8 text.
- `repairCommentIds` and `countPdfPages` gain `async` (both already called from
  async contexts — `packDocx`/`measure` — so this doesn't propagate further).
- All 5 `execFileSync` calls become `` $`...` `` calls:
  - `unzip -q ${docxPath} -d ${tmp}` → add `.quiet()`
  - `zip -Xrq ${docxPath} .` (had `{ cwd: tmp }`) → add `.cwd(tmp).quiet()`
  - `soffice ...` (had `{ stdio: "ignore" }`) → add `.quiet()`
  - `python3 .../soffice.py ...` (had `{ stdio: "ignore" }`) → add `.quiet()`
  - `pdfinfo ${pdfPath}` (had `{ encoding: "utf-8" }`, return value used) → add
    `.text()` to capture stdout
  - **`.quiet()` goes on all 5, not just the 2 that had `stdio: "ignore"`
    before** — Bun Shell echoes stdout/stderr to the parent by default, whereas
    `execFileSync`'s default silently pipes-and-discards. Omitting `.quiet()` on
    `unzip`/`zip`/`pdfinfo` would leak subprocess output into the CLI's own
    stdout — a real, easy-to-miss regression, not a crash.
- Existing `try`/`catch` control flow (outer catch-returns-0 in
  `repairCommentIds`, soffice→python3 fallback catch in `convertToPdf`,
  catch-returns-`-1` in `countPdfPages`) needs **no logic changes** — Bun
  Shell's default throw-on-nonzero-exit matches `execFileSync`'s current
  behavior.

### `src/autofit.ts`
```ts
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
```
- Only change beyond renames: the single `DEBUG_AUTOFIT` `fs.existsSync(pdfPath)`
  line becomes `await Bun.file(pdfPath).exists()` — free, already inside the
  async `measure()` function.

### `scripts/generate-skill-bundle.ts`
```ts
import { mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
```
- `readFileSync`/`writeFileSync` → `Bun.file()`/`Bun.write()`.
- `main()` becomes `async`, invoked as `main().catch(...)` at the bottom instead
  of a bare synchronous call.
- Included despite being build-time-only tooling — see Scope above.

### `src/node-shim.d.ts`
- `declare module "fs"` → `declare module "node:fs"` (same for `path`/`os`).
- `declare module "child_process"` block deleted — nothing imports it anymore
  post-change.
- Two pre-existing gaps found and fixed while rewriting this (unrelated to this
  change's purpose, but touched by it): `chmodSync` was missing from the `fs`
  shim and `homedir` was missing from the `os` shim, even though `cli.ts`
  already calls both — meaning the shim fallback would already fail to
  typecheck those call sites if `@types/node` were ever unavailable. Also adding
  `relative` (needed by `generate-skill-bundle.ts`, not previously declared).
- Verified zero identifier collisions: no local variable/function in any
  touched file shadows `join`/`resolve`/`dirname`/`basename`/`relative`/
  `mkdirSync`/`mkdtempSync`/`rmSync`/`chmodSync`/`homedir`/`tmpdir`.

## Error handling & determinism

- **Throw semantics preserved.** Bun Shell throws `ShellError` on nonzero exit
  by default — same throw-based propagation as `execFileSync` today.
- **Output-echo parity requires explicit `.quiet()`** on all 5 shell calls (see
  above) — this is the one place default behavior differs in a way that doesn't
  crash but silently changes output.
- **File-read error parity confirmed empirically**, not assumed:
  `Bun.file(missingPath).text()` was tested directly this session and throws
  `Error` with `code: "ENOENT"` — same shape `fs.readFileSync` throws today.
  Matters for `readJson`'s unguarded reads and `generate-skill-bundle.ts`'s
  `SKILL.md` reads, which rely on that throw to fail loudly rather than
  silently producing empty output.
- **No new concurrency anywhere.** Every conversion keeps strict sequential
  `await` at each former sync-call site — no `Promise.all`, no fire-and-forget.
  Ordering guarantees this deterministic-output project depends on (e.g.
  `repairCommentIds`'s read→patch→write→rezip sequence) are preserved exactly.
- **Known unverifiable-in-CI gap, stated plainly:** `pack.ts` ships in the
  Windows binary too. `release.yml` cross-compiles all 6 targets from a single
  `ubuntu-latest` runner and never executes the Windows build, so Bun Shell's
  cross-platform behavior on Windows can't be validated by this repo's CI as
  configured today. This risk already exists for the PDF toolchain in general
  (README already flags Windows LibreOffice as a manual install) — this change
  doesn't newly introduce it, but doesn't resolve it either.

## Testing / verification plan

No new automated test suite (repo has none today; out of scope per above).
Verification stays consistent with the project's existing build-and-inspect
approach, plus targeted regression checks on exactly what changed:

1. `bun run build` (tsc) clean — catches every renamed call site at the type
   level.
2. `bun run compile`, then run the **compiled binary itself** against a real
   file argument, not just `bun dist/cli.js`. `CLAUDE.md` already documents a
   virtual-FS gotcha specific to the compiled binary; `Bun.file`/`Bun.write`
   here always target real user-supplied/tmp paths (never the bundled
   schema/theme resources, which stay static-imported and are unaffected by
   this change) — but this needs an explicit compiled-binary smoke test given
   the project's own history here, not an assumption.
3. Render both `data/priyanka.resume.json` (multi-page ground truth) and
   `data/tailored-golang.example.json` (`--one-pager`) through both
   `bun dist/cli.js` and the compiled binary — the existing documented
   validation loop.
4. **Regression-diff, not just no-crash:** compare PDF page counts and
   `commentIdsFixed` output before/after on the same inputs — `repairCommentIds`,
   `convertToPdf`, `countPdfPages` are exactly the functions being rewritten.
5. `--install-skill` (bare and named) against a scratch `$HOME`, confirming both
   `~/.claude/skills/` and `~/.copilot/skills/` still get written — exercises the
   newly-async `installSkill`/`parseArgs` path directly.
6. `bun run prepare-skill` — diff the generated `src/skill-bundle.generated.ts`
   before/after; should be byte-identical, since only the I/O mechanism changed,
   not the content logic.
7. Quick `checkPdfToolchain()`/`Bun.which` regression check — same file,
   unaffected logic, cheap to confirm untouched.
8. Re-run the known repeated-conversion flakiness scenario from `CLAUDE.md`
   (`DEBUG_AUTOFIT=1`, rapid one-pager autofit) at least once — not required to
   fix it, just confirm this change doesn't make the pre-existing issue worse.
