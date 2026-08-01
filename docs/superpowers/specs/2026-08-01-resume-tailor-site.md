# resume-tailor: public rebrand + GitHub Pages demo site

Date: 2026-08-01

## Overview

Rebrand this repo as **resume-tailor** and give it a public-facing home: a
GitHub Pages site with a client-side-only DOCX demo, an SVG infographic
explaining the pipeline, SEO metadata, and a one-line install script for the
CLI (renamed `tailor-resume`) plus its Claude Code / GitHub Copilot skills.

## Decisions made during brainstorming (with reasoning, not just the outcome)

- **Name:** GitHub repo `subho57/resume-tailor` (renamed from `resume-builder`
  — done). CLI binary command: `tailor-resume` (renamed from `build-resume` —
  distinct word order from the repo name, both explicit, deliberate choices).
  npm/package name: `resume-tailor` (matches the repo; doesn't need to match
  the binary name).
- **Visibility:** repo is now **public** (changed from private during this
  session, after explicitly re-confirming twice that this permanently exposes
  three real candidates' PII already in git history — Aritrika Karmakar's,
  Priyanka Chatterjee's, and Bhaskar's resume data, including names, emails,
  phone numbers, and employers — since deleting the files today doesn't
  remove already-committed history. The user's informed, twice-repeated
  decision: proceed anyway.
- **What "try it online" means:** client-side-only. GitHub Pages has no
  server, so LibreOffice/Poppler (PDF conversion, `--one-pager` autofit)
  cannot run there — verified this isn't a workaroundable limitation, not
  assumed. `docx-js`'s `Packer.toBlob()` (confirmed present in the installed
  `docx` package's own type definitions) *can* run in a browser, so DOCX
  generation is real; PDF preview is not, without a paid backend, which is
  explicitly out of scope.
- **Renderer reuse:** `src/render.ts`, `src/theme.ts`, `src/validate.ts`,
  `src/types.ts` have zero Node/Bun-specific imports (checked directly, not
  assumed) — the browser bundle imports them unmodified, no duplication.
- **Comment-repair step skipped in the browser demo.** `pack.ts`'s
  `repairCommentIds` (works around a docx v9 bug where `flagged`-highlight
  Word comments can serialize as `[object Object]`) shells out to
  `unzip`/`zip` — not browser-portable as written. Only matters if a visitor's
  pasted JSON has `flagged` highlights. Documented as a known limitation of
  the demo, not silently fixed or silently broken.
- **Binary distribution:** since the repo is public, GitHub Releases assets
  are directly downloadable by anyone with no auth — `install.sh` and the
  site link straight to
  `github.com/subho57/resume-tailor/releases/latest/download/<asset>`, no
  proxy/republish step needed.
- **Windows:** Beta badge on the site, direct link to the latest
  `tailor-resume-windows-x64.zip` release asset. `install.sh` covers
  macOS/Linux only.
- **Prerequisite install strategy in `install.sh`:** macOS uses `brew` (per
  the user's ask). Linux defaults to `apt`/`dnf` detection first, falling back
  to mentioning `brew` only if neither is found — because Homebrew on Linux
  doesn't support `--cask`, so LibreOffice via Linuxbrew is unreliable, and
  this matches the existing README's own per-OS instructions. Flagged as a
  deliberate deviation from a literal "brew on both platforms" reading of the
  request, not an oversight.
- **Positioning:** the actual problem this solves — one hand-edited resume
  drifting across dozens of applications, or the temptation to fabricate/
  inflate keywords under JD pressure — is the site's lead message, not just a
  feature list. "Entirely free": no account, no subscription, a static binary
  plus the AI assistant the visitor already has. "Works with your existing
  Claude Code / Copilot subscription": `--install-skill` writes into
  `~/.claude/skills/` and `~/.copilot/skills/`, whichever the visitor already
  has installed — no new product, no new subscription.

## Architecture

### New: `site/` (own `package.json`, isolated from the CLI's `bun install`)

```
site/
  index.html          Hero, problem statement, infographic, JSON editor,
                       theme picker, example picker, Generate button,
                       warnings panel, download link, install instructions,
                       Windows Beta badge + link.
  main.ts              Wiring only: imports ../src/render.ts, theme.ts,
                       validate.ts, types.ts, ../schema/resume.schema.json,
                       ../themes/*.theme.json unmodified. JSON editor is
                       CodeMirror 6 (@codemirror/lang-json for syntax
                       highlighting) — lighter than Monaco for a single-page
                       demo, no other editor evaluated since this was the
                       one proposed and unobjected-to in the approaches
                       discussion.
  examples/fictional-sample.resume.json   One new, clearly-fake example.
  infographic.svg      Hand-authored: JSON source -> validate -> tailor
                       (never fabricate) -> autofit/render -> DOCX/PDF.
  style.css
  vite.config.ts       base: '/resume-tailor/' (matches the Pages subpath).
  public/
    install.sh          Static file, copied as-is into the build output.
    sitemap.xml
    robots.txt
```

### Data flow (unchanged from the earlier design, restated for completeness)

Edit JSON/pick theme/pick example -> click Generate -> `JSON.parse` (catch
syntax errors inline, no render attempt) -> `validate(schema, content)`
(warnings shown, never blocking, matching the CLI's own best-effort
philosophy) -> `resolveTheme` -> `renderResume` -> `Packer.toBlob(doc)` ->
`URL.createObjectURL` -> auto-download `<name>.docx`.

### `install.sh` (macOS + Linux)

1. Detect OS (`darwin`/`linux`) and arch (`x64`/`arm64`).
2. Download the matching archive from
   `github.com/subho57/resume-tailor/releases/latest/download/tailor-resume-<os>-<arch>.tar.gz`,
   extract, `chmod +x`, move to `~/.local/bin` (create + note PATH addition if
   not already on PATH).
3. Run `tailor-resume --install-skill` — installs `jd-tailored-resume` and
   `master-resume-builder` into both `~/.claude/skills/` and
   `~/.copilot/skills/`.
4. Check for `soffice`/`pdfinfo`/Carlito on PATH. macOS: install via `brew`
   if present, else print the exact `brew install` commands and stop. Linux:
   detect `apt`/`dnf` first and use the matching install command; if neither
   is found, print the `brew` commands as a fallback along with a note that
   Homebrew's Linux `--cask` support is limited.
5. Print a success summary + next steps (`tailor-resume --version`, where the
   skills landed).

### `.github/workflows/deploy-pages.yml` (new, separate from `release.yml`)

- Triggers: push to `main` scoped to `site/**` + the reused `src/*` files +
  `schema/**` + `themes/**` (avoid redeploying on unrelated CLI-only commits).
- Steps: checkout -> `actions/configure-pages@v6` -> setup Bun -> `bun install`
  + `bun run build` inside `site/` -> `actions/upload-pages-artifact@v5`
  (uploading `site/dist/`) -> `actions/deploy-pages@v5`.
- **One-time manual setup, not automatic:** switch the repo's Pages source
  from "Deploy from branch: `main`/`/`" to "GitHub Actions"
  (`gh api -X PUT repos/{owner}/{repo}/pages -f build_type=workflow`). Even
  though the repo is now public (so the original "private repo, public leak"
  urgency is gone), this is still the right end-state — Pages should serve
  only the built site, not the raw repo tree, on general principle.

### Renames across the existing codebase (mechanical, not a design decision — listing so nothing gets missed)

- `package.json`: `name` -> `resume-tailor`, `bin` key -> `tailor-resume`.
- `src/cli.ts`: help text, usage comments, `--install-skill` doc references
  the new binary name.
- `scripts/generate-skill-bundle.ts`'s `transformJdTailoredResumeSkillMd` /
  `transformMasterResumeBuilderSkillMd`: every standalone-doc mention of
  `build-resume` becomes `tailor-resume`.
- `README.md`, `CLAUDE.md`: every `build-resume` mention, plus the repo URL
  (`subho57/resume-builder` -> `subho57/resume-tailor`).
- `.github/workflows/release.yml`: release asset names
  (`build-resume-<platform>` -> `tailor-resume-<platform>`).
- `.claude/skills/*/SKILL.md`: any `build-resume` mention in the
  project-flavored (non-standalone) text.

## SEO

- `site/index.html`: descriptive `<title>`, meta description, OG tags,
  `application/ld+json` (SoftwareApplication schema), canonical URL.
- `site/public/sitemap.xml`: single-page site, lists the root URL (kept
  correct/minimal rather than padded with fabricated routes).
- `site/public/robots.txt`: allow all, point at the sitemap.
- GitHub repo topics (`gh repo edit --add-topic`): `resume`,
  `resume-builder`, `ats`, `json-resume`, `cv-generator`, `docx`,
  `job-search`, `resume-tailoring`.

## Testing

No existing test-suite pattern applies (browser demo, not the CLI). Plan:
`bun run dev` (Vite) locally — verify edit-to-download round-trips to a valid
`.docx` matching the CLI's output for the same JSON+theme; verify malformed-
JSON and schema-warning paths; verify theme switch and example picker; run
`install.sh` on a real macOS machine and a real Linux VM/container (both with
and without `brew`/`apt` present) rather than assuming the branch logic is
correct; verify the deployed Pages URL end-to-end once live.
