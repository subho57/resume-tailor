# resume-tailor Rebrand + Pages Demo Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the CLI (`build-resume` → `tailor-resume`) and repo metadata, then ship a public GitHub Pages site with a client-side-only DOCX demo, an SVG infographic, SEO metadata, and a one-line `install.sh` for the CLI + its Claude Code/Copilot skills.

**Architecture:** Two independent halves. Half A is a mechanical rename across existing files (package.json, README, CLAUDE.md, cli.ts, generate-skill-bundle.ts, release.yml) — no new subsystem, just string changes plus regenerating the derived skill bundle. Half B is a brand-new `site/` Vite project that imports the existing `src/render.ts`/`theme.ts`/`validate.ts`/`types.ts` unmodified (verified zero Node/Bun-specific imports in these 4 files during brainstorming) to run the renderer client-side, plus `install.sh` and a new deploy workflow. Half A must land first since Half B's copy/install.sh reference the new binary name.

**Tech Stack:** Vite (browser bundler), CodeMirror 6 + `@codemirror/lang-json` (JSON editor), `docx`'s `Packer.toBlob()` (browser-native DOCX blob), GitHub Actions `actions/configure-pages@v6` + `actions/upload-pages-artifact@v5` + `actions/deploy-pages@v5`.

## Global Constraints

- Repo is `subho57/resume-tailor`, already renamed and made **public** (both already done, confirmed via `gh repo view`).
- CLI binary command: `tailor-resume` (was `build-resume`). Package name: `resume-tailor` (was `resume-superset-builder`).
- `docs/superpowers/plans/*.md`, `docs/superpowers/specs/*.md`, and `CHANGELOG.md` are explicitly **out of scope** for the rename — they're historical records (CHANGELOG.md is semantic-release-owned and must never be hand-edited per this repo's own rule).
- The 4 reused renderer files (`src/render.ts`, `src/theme.ts`, `src/validate.ts`, `src/types.ts`) must NOT be modified — the whole point is reusing them as-is in the browser bundle. If a task needs to touch one of them, stop and flag it — that's a sign the design assumption (they're portable unmodified) was wrong.
- `site/` gets its own `package.json`, isolated from the root `bun install` — no new devDependencies in the root project.
- GitHub Releases are now public and directly downloadable with no auth — `install.sh` and site copy link straight to `github.com/subho57/resume-tailor/releases/latest/download/<asset>`.
- Windows: Beta badge + direct `.zip` link on the site; `install.sh` covers macOS/Linux only, explicitly rejects Windows with a message pointing at the manual download.

---

### Task 1: Rebrand renames + GitHub topics

**Files:**
- Modify: `package.json`
- Modify: `src/cli.ts:168`
- Modify: `scripts/generate-skill-bundle.ts` (the two `transform*SkillMd` functions' standalone-doc replacement text)
- Modify: `README.md` (17 occurrences of `build-resume`, 1 repo-URL + private/public framing paragraph)
- Modify: `CLAUDE.md:35,116` (2 occurrences of `build-resume`)
- Modify: `.github/workflows/release.yml` (matrix `binaryName`/`archiveName` values + 2 comments)
- Modify: `.claude/skills/jd-tailored-resume/SKILL.md` — no change needed (verified it never says `build-resume` literally; only the derived standalone variant does, which comes from `generate-skill-bundle.ts`'s transform).

**Interfaces:**
- Consumes: nothing.
- Produces: every later task in this plan (site copy, `install.sh`, workflow) references `tailor-resume` as the binary/asset name — this task is what makes that name real.

- [ ] **Step 1: Rename `package.json`'s `name` and `bin` key**

Find in `package.json`:
```json
  "name": "resume-superset-builder",
```
Replace with:
```json
  "name": "resume-tailor",
```
Find:
```json
  "bin": {
    "build-resume": "dist/cli.js"
  },
```
Replace with:
```json
  "bin": {
    "tailor-resume": "dist/cli.js"
  },
```
Find:
```json
    "compile": "bun run prepare-skill && bun build --compile --outfile=bin/build-resume ./src/cli.ts",
```
Replace with:
```json
    "compile": "bun run prepare-skill && bun build --compile --outfile=bin/tailor-resume ./src/cli.ts",
```

- [ ] **Step 2: Rename the one runtime string in `src/cli.ts`**

Find in `src/cli.ts` (line 168):
```ts
      console.log(`✓ Installed ${skillName} skill (standalone variant — uses build-resume directly, no repo) to:`);
```
Replace with:
```ts
      console.log(`✓ Installed ${skillName} skill (standalone variant — uses tailor-resume directly, no repo) to:`);
```

- [ ] **Step 3: Update `scripts/generate-skill-bundle.ts`'s standalone-doc transforms**

This file's two `transform*SkillMd` functions rewrite each skill's SKILL.md into a "standalone" variant (installed via `--install-skill`) that tells the reader to run `build-resume ...`. Every one of those replacement blocks needs `build-resume` → `tailor-resume`. Run this to find every occurrence first:

```bash
grep -n "build-resume" scripts/generate-skill-bundle.ts
```
Expected: lines inside `transformJdTailoredResumeSkillMd`'s and `transformMasterResumeBuilderSkillMd`'s **`newText`** template strings (the "after" side of each `assertReplace` call) — e.g. a block containing:
````
`build-resume\` is a standalone binary — no repo, no install/build step, no \`bun\`.

\`\`\`bash
build-resume \\
  --content <output_folder>/<FileName>.resume.json \\
````
For every such occurrence found by the grep above, replace `build-resume` with `tailor-resume` in that line. Do NOT touch the `oldText` side of any `assertReplace` call (those describe the *current, unmodified* project-flavored `SKILL.md` text, which never said `build-resume` in the first place — changing `oldText` would break `assertReplace`'s exact-match requirement against the real file).

- [ ] **Step 4: Rename asset names in `.github/workflows/release.yml`**

Find:
```yaml
  # Cross-compiles build-resume for every target from this single Linux runner (bun
```
Replace with:
```yaml
  # Cross-compiles tailor-resume for every target from this single Linux runner (bun
```
Find the whole matrix block:
```yaml
      matrix:
        include:
          - target: bun-linux-x64
            binaryName: build-resume
            archiveName: build-resume-linux-x64.tar.gz
          - target: bun-linux-arm64
            binaryName: build-resume
            archiveName: build-resume-linux-arm64.tar.gz
          - target: bun-darwin-x64
            binaryName: build-resume
            archiveName: build-resume-macos-x64.tar.gz
          - target: bun-darwin-arm64
            binaryName: build-resume
            archiveName: build-resume-macos-arm64.tar.gz
          - target: bun-windows-x64
            binaryName: build-resume.exe
            archiveName: build-resume-windows-x64.zip
          - target: bun-windows-arm64
            binaryName: build-resume.exe
            archiveName: build-resume-windows-arm64.zip
```
Replace with:
```yaml
      matrix:
        include:
          - target: bun-linux-x64
            binaryName: tailor-resume
            archiveName: tailor-resume-linux-x64.tar.gz
          - target: bun-linux-arm64
            binaryName: tailor-resume
            archiveName: tailor-resume-linux-arm64.tar.gz
          - target: bun-darwin-x64
            binaryName: tailor-resume
            archiveName: tailor-resume-macos-x64.tar.gz
          - target: bun-darwin-arm64
            binaryName: tailor-resume
            archiveName: tailor-resume-macos-arm64.tar.gz
          - target: bun-windows-x64
            binaryName: tailor-resume.exe
            archiveName: tailor-resume-windows-x64.zip
          - target: bun-windows-arm64
            binaryName: tailor-resume.exe
            archiveName: tailor-resume-windows-arm64.zip
```
Find:
```yaml
      # +x, only `build-resume` inside it does, and that's preserved by tar's own
```
Replace with:
```yaml
      # +x, only `tailor-resume` inside it does, and that's preserved by tar's own
```

- [ ] **Step 5: Global rename in `README.md`, plus the repo URL and the private→public framing**

Run this to do the mechanical part (verify the count before/after):
```bash
grep -c "build-resume" README.md   # expect 17
sed -i '' 's/build-resume/tailor-resume/g' README.md   # macOS sed; drop the '' arg on Linux
grep -c "build-resume" README.md   # expect 0
grep -c "tailor-resume" README.md  # expect 17
```
Then fix the repo-URL + visibility paragraph by hand (the mechanical sed above already turned `build-resume` into `tailor-resume` inside the URL path too, which is wrong — the URL segment is the *repo name*, `resume-tailor`, not the binary name). Find:
```markdown
Prebuilt binaries are published to
[GitHub Releases](https://github.com/subho57/tailor-resume/releases). This repo is
private, so downloading a release asset needs repo access (`gh release download`
while authenticated, or a browser session logged in with access).
```
Replace with:
```markdown
Prebuilt binaries are published to
[GitHub Releases](https://github.com/subho57/resume-tailor/releases) — the repo is
public, so anyone can download a release asset directly, no authentication needed.
```

- [ ] **Step 5b: Rename the 2 occurrences in `CLAUDE.md`**

Find (line 35):
```markdown
bun run compile                # bun build --compile -> bin/build-resume (standalone binary)
```
Replace with:
```markdown
bun run compile                # bun build --compile -> bin/tailor-resume (standalone binary)
```
Find (line 116):
```markdown
(repo/bun instructions -> `build-resume` instructions) via an `assertReplace()`
```
Replace with:
```markdown
(repo/bun instructions -> `tailor-resume` instructions) via an `assertReplace()`
```

- [ ] **Step 6: Regenerate the skill bundle and verify the build**

```bash
bun run build
```
Expected: `✓ Generated src/skill-bundle.generated.ts (2 skills, 10 files total: jd-tailored-resume, master-resume-builder)` followed by a clean `tsc` exit (no errors). This regenerates `src/skill-bundle.generated.ts` (gitignored) with the `tailor-resume`-renamed standalone doc text from Step 3.

- [ ] **Step 7: Functional check — the renamed binary actually works**

```bash
bun run compile
./bin/tailor-resume --version
./bin/tailor-resume --content data/priyanka.resume.json --out /tmp/tailor-resume-check
grep -c "tailor-resume" /tmp/fake-home-check-unused 2>/dev/null; true
rm -rf /tmp/tailor-resume-fake-home && HOME=/tmp/tailor-resume-fake-home ./bin/tailor-resume --install-skill master-resume-builder
grep -rn "build-resume" /tmp/tailor-resume-fake-home 2>/dev/null; echo "exit=$? (expect 1, no matches)"
```
Expected: `--version` prints the version; the content render prints `✓ DOCX:`/`✓ PDF:` exactly as before (same page/comment counts as any earlier session run against `data/priyanka.resume.json`); `--install-skill` writes to `/tmp/tailor-resume-fake-home/.claude/skills/master-resume-builder/` and `/tmp/tailor-resume-fake-home/.copilot/skills/master-resume-builder/`; the final `grep` finds **zero** remaining `build-resume` mentions in the installed skill files (confirms Step 3's transform edits actually took effect in the generated output, not just in the source script).

- [ ] **Step 8: Add GitHub topics**

```bash
gh repo edit subho57/resume-tailor --add-topic resume --add-topic resume-builder --add-topic ats --add-topic json-resume --add-topic cv-generator --add-topic docx --add-topic job-search --add-topic resume-tailoring
gh repo view subho57/resume-tailor --json repositoryTopics
```
Expected: the JSON output lists all 8 topics.

- [ ] **Step 9: Commit**

```bash
git add package.json src/cli.ts scripts/generate-skill-bundle.ts README.md CLAUDE.md .github/workflows/release.yml
git commit -m "$(cat <<'EOF'
feat: rename build-resume to tailor-resume, resume-superset-builder to resume-tailor

Renames the CLI binary command, npm package name, and release asset
names to match the new public repo (subho57/resume-tailor). Updates
README's Releases section for the repo's new public visibility (no
auth needed to download release assets anymore). generate-skill-bundle.ts's
standalone-doc transforms updated so --install-skill's derived text
also says tailor-resume.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `site/` scaffold — Vite + CodeMirror browser demo

**Files:**
- Create: `site/package.json`
- Create: `site/vite.config.ts`
- Create: `site/tsconfig.json`
- Create: `site/index.html`
- Create: `site/main.ts`
- Create: `site/style.css`
- Create: `site/examples/fictional-sample.resume.json`

**Interfaces:**
- Consumes: `../src/render.ts`'s `renderResume(content: ResumeContent, theme: ResolvedTheme, keywords: string[] = []): RenderResult` (where `RenderResult` has a `.doc` field, a `docx` `Document`); `../src/theme.ts`'s `resolveTheme(t: Theme | undefined): ResolvedTheme`; `../src/validate.ts`'s `validate(schema: unknown, data: unknown): Warning[]` (where `Warning` is `{ path: string; message: string }`); `../schema/resume.schema.json`; `../themes/corporate-navy.theme.json` and `../themes/slate-compact.theme.json`; `docx`'s `Packer.toBlob(doc): Promise<Blob>`.
- Produces: a working `bun run build` (inside `site/`) that emits `site/dist/` — Task 3 adds content on top of this scaffold, Task 5's workflow deploys `site/dist/`.

- [ ] **Step 1: Create `site/package.json`**

```json
{
  "name": "resume-tailor-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "devDependencies": {
    "vite": "^7.0.0",
    "typescript": "^5.7.0",
    "@codemirror/lang-json": "^6.0.1",
    "@codemirror/state": "^6.5.0",
    "@codemirror/view": "^6.36.0",
    "codemirror": "^6.0.1"
  },
  "dependencies": {
    "docx": "9.7.1"
  }
}
```

- [ ] **Step 2: Install and verify**

```bash
cd site && bun install
```
Expected: exits 0, creates `site/node_modules` and `site/bun.lock`.

- [ ] **Step 3: Create `site/vite.config.ts`**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "/resume-tailor/",
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 4: Create `site/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["*.ts", "../src/render.ts", "../src/theme.ts", "../src/validate.ts", "../src/types.ts"]
}
```

- [ ] **Step 5: Create `site/examples/fictional-sample.resume.json`**

A brand-new, clearly-fake example — no relation to any real candidate's data in `data/`:

```json
{
  "schemaVersion": "1.0.0",
  "basics": {
    "name": "Jamie Rivera",
    "label": "Senior Backend Engineer",
    "email": "jamie.rivera@example.com",
    "phone": "+1 555 0100",
    "location": { "display": "Austin, TX, USA" },
    "profiles": [
      { "network": "GitHub", "url": "https://github.com/example", "display": "github.com/example" }
    ],
    "summaries": {
      "default": "Backend engineer with 6+ years building distributed systems in Go and Python. Led a migration from a monolith to event-driven microservices at Northwind Data, cutting p99 latency by 40% and reducing on-call incidents by half."
    },
    "activeSummary": "default"
  },
  "work": [
    {
      "name": "Northwind Data",
      "location": "Remote",
      "position": "Senior Backend Engineer",
      "startDate": "2021-03",
      "endDate": "",
      "dateDisplay": "March 2021 – Present",
      "highlights": [
        "Led the migration from a monolithic Rails app to event-driven Go microservices, cutting p99 API latency by 40%.",
        "Introduced a Kafka-based event pipeline with consumer groups and dead-letter queues, reducing data-loss incidents to zero.",
        "Mentored 3 junior engineers and ran the team's on-call rotation, halving P1 incident volume over two quarters."
      ]
    },
    {
      "name": "Fictional Robotics Inc.",
      "location": "Austin, TX",
      "position": "Backend Engineer",
      "startDate": "2018-06",
      "endDate": "2021-02",
      "dateDisplay": "June 2018 – February 2021",
      "highlights": [
        "Built a REST API in Python/Flask serving telemetry data for a fleet of 200+ warehouse robots.",
        "Migrated the primary datastore from MySQL to PostgreSQL with zero downtime."
      ]
    }
  ],
  "education": [
    {
      "institution": "University of Example",
      "area": "Computer Science",
      "studyType": "BS",
      "dateDisplay": "2014 – 2018"
    }
  ],
  "skills": [
    { "name": "Languages", "keywords": ["Go", "Python", "SQL"] },
    { "name": "Infrastructure", "keywords": ["Kafka", "Docker", "Kubernetes", "PostgreSQL"] }
  ]
}
```

- [ ] **Step 6: Create `site/main.ts`**

```ts
import { EditorView, basicSetup } from "codemirror";
import { json as jsonLang } from "@codemirror/lang-json";
import { Packer, Document } from "docx";
import { validate } from "../src/validate";
import { resolveTheme } from "../src/theme";
import { renderResume } from "../src/render";
import type { ResumeContent, Theme } from "../src/types";

import resumeSchema from "../schema/resume.schema.json";
import corporateNavy from "../themes/corporate-navy.theme.json";
import slateCompact from "../themes/slate-compact.theme.json";
import fictionalSample from "./examples/fictional-sample.resume.json";

const BUILTIN_THEMES: Record<string, Theme> = {
  "corporate-navy": corporateNavy as Theme,
  "slate-compact": slateCompact as Theme,
};

const editorContainer = document.getElementById("editor")!;
const themeSelect = document.getElementById("theme-select") as HTMLSelectElement;
const generateButton = document.getElementById("generate") as HTMLButtonElement;
const warningsPanel = document.getElementById("warnings")!;
const statusPanel = document.getElementById("status")!;

const editor = new EditorView({
  doc: JSON.stringify(fictionalSample, null, 2),
  extensions: [basicSetup, jsonLang()],
  parent: editorContainer,
});

function showWarnings(messages: string[]) {
  warningsPanel.innerHTML = "";
  if (messages.length === 0) return;
  const list = document.createElement("ul");
  for (const msg of messages) {
    const item = document.createElement("li");
    item.textContent = msg;
    list.appendChild(item);
  }
  warningsPanel.appendChild(list);
}

function showStatus(message: string, isError: boolean) {
  statusPanel.textContent = message;
  statusPanel.className = isError ? "status error" : "status success";
}

generateButton.addEventListener("click", async () => {
  showWarnings([]);
  showStatus("", false);

  let content: ResumeContent;
  try {
    content = JSON.parse(editor.state.doc.toString());
  } catch (e) {
    showStatus(`Invalid JSON: ${(e as Error).message}`, true);
    return;
  }

  const contentWarnings = validate(resumeSchema, content);
  // No theme validation here (unlike the CLI's main()) — themeRaw is always one of
  // our own bundled built-in presets, selected from a fixed dropdown, never
  // user-edited JSON, so there's nothing for validate() to usefully catch.
  const themeRaw = BUILTIN_THEMES[themeSelect.value] ?? BUILTIN_THEMES["corporate-navy"];
  const theme = resolveTheme(themeRaw);

  if (contentWarnings.length > 0) {
    showWarnings(contentWarnings.map((w) => `${w.path}: ${w.message}`));
  }

  try {
    // No comment-repair pass here, unlike the CLI's packDocx() — that step shells
    // out to unzip/zip to work around a docx v9 bug where flagged-highlight Word
    // comments can serialize as "[object Object]", and unzip/zip aren't available
    // in a browser. Only matters if the JSON has `flagged: true` highlights; see
    // the on-page note next to the editor.
    const { doc } = renderResume(content, theme, []);
    const blob = await Packer.toBlob(doc as Document);
    const url = URL.createObjectURL(blob);
    const basename = (content.basics?.name || "resume").replace(/[^\w.-]+/g, "_");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${basename}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus("Generated — check your downloads.", false);
  } catch (e) {
    showStatus(`Render failed: ${(e as Error).message}`, true);
  }
});
```

- [ ] **Step 7: Create `site/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>resume-tailor</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>resume-tailor</h1>
      <div class="controls">
        <label for="theme-select">Theme</label>
        <select id="theme-select">
          <option value="corporate-navy">Corporate Navy</option>
          <option value="slate-compact">Slate Compact</option>
        </select>
        <button id="generate">Generate .docx</button>
      </div>
      <div id="editor"></div>
      <div id="warnings"></div>
      <div id="status" class="status"></div>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `site/style.css`**

```css
body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; max-width: 900px; }
.controls { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; }
#editor { border: 1px solid #ccc; height: 400px; overflow: auto; }
.status { margin-top: 1rem; font-weight: bold; }
.status.error { color: #b00020; }
.status.success { color: #0a7d2c; }
```

- [ ] **Step 9: Build and manually verify**

```bash
cd site && bun run build
```
Expected: exits 0, produces `site/dist/index.html` + JS/CSS assets.

```bash
cd site && bun run dev
```
Open the printed local URL in a browser. Verify: the editor loads pre-filled with the fictional sample; clicking "Generate .docx" downloads a `Jamie_Rivera.docx`; open it in Word/LibreOffice and confirm it renders the same content/layout the CLI would produce for the same JSON+theme (spot-check against `bun dist/cli.js --content site/examples/fictional-sample.resume.json --out /tmp/site-check` from the repo root and comparing).

- [ ] **Step 10: Commit**

```bash
git add site/package.json site/vite.config.ts site/tsconfig.json site/index.html site/main.ts site/style.css site/examples/fictional-sample.resume.json site/.gitignore
git commit -m "$(cat <<'EOF'
feat: scaffold site/ - client-side browser demo of the resume renderer

Vite + CodeMirror 6 JSON editor wired directly to the existing
src/render.ts/theme.ts/validate.ts/types.ts (unmodified, verified
Node/Bun-free during brainstorming) and docx's Packer.toBlob() for an
in-browser DOCX download. New fictional example resume, no real
candidate data. Own package.json, isolated from the root bun install.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Note: create `site/.gitignore` before this commit with contents:
```
node_modules
dist
bun.lock
```

---

### Task 3: Site content — infographic, copy, SEO

**Files:**
- Create: `site/infographic.svg`
- Modify: `site/index.html` (add hero copy, infographic, install instructions, Windows Beta link, SEO meta tags)
- Create: `site/public/sitemap.xml`
- Create: `site/public/robots.txt`

**Interfaces:**
- Consumes: Task 2's `site/index.html` structure (adds to it, doesn't replace the editor/controls/warnings/status elements Task 2's `main.ts` already binds to by `id`).
- Produces: nothing new consumed by later tasks — Task 4/5 don't depend on this task's content specifically, only on `site/` existing as a buildable Vite project (already true after Task 2).

- [ ] **Step 1: Create `site/infographic.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 160" role="img" aria-label="Pipeline: JSON source of truth, validated, tailored without fabricating, autofit and rendered, to DOCX and PDF">
  <defs>
    <style>
      .box { fill: #f5f7fa; stroke: #1a3a5c; stroke-width: 2; rx: 8; }
      .label { font-family: system-ui, sans-serif; font-size: 14px; fill: #1a3a5c; text-anchor: middle; }
      .sub { font-family: system-ui, sans-serif; font-size: 11px; fill: #55606e; text-anchor: middle; }
      .arrow { stroke: #1a3a5c; stroke-width: 2; marker-end: url(#arrowhead); }
    </style>
    <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#1a3a5c" />
    </marker>
  </defs>
  <g>
    <rect class="box" x="10" y="40" width="150" height="70" />
    <text class="label" x="85" y="70">JSON source</text>
    <text class="sub" x="85" y="88">of truth</text>
  </g>
  <line class="arrow" x1="160" y1="75" x2="195" y2="75" />
  <g>
    <rect class="box" x="200" y="40" width="150" height="70" />
    <text class="label" x="275" y="70">Validate</text>
    <text class="sub" x="275" y="88">best-effort</text>
  </g>
  <line class="arrow" x1="350" y1="75" x2="385" y2="75" />
  <g>
    <rect class="box" x="390" y="40" width="170" height="70" />
    <text class="label" x="475" y="65">Tailor to the job</text>
    <text class="sub" x="475" y="83">select &amp; rephrase,</text>
    <text class="sub" x="475" y="97">never fabricate</text>
  </g>
  <line class="arrow" x1="560" y1="75" x2="595" y2="75" />
  <g>
    <rect class="box" x="600" y="40" width="150" height="70" />
    <text class="label" x="675" y="65">Autofit</text>
    <text class="sub" x="675" y="83">&amp; render</text>
  </g>
  <line class="arrow" x1="750" y1="75" x2="785" y2="75" />
  <g>
    <rect class="box" x="790" y="40" width="100" height="70" />
    <text class="label" x="840" y="70">DOCX</text>
    <text class="sub" x="840" y="88">+ PDF</text>
  </g>
</svg>
```

- [ ] **Step 2: Add hero copy, infographic, install instructions, and SEO tags to `site/index.html`**

Find:
```html
    <title>resume-tailor</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>resume-tailor</h1>
      <div class="controls">
```
Replace with:
```html
    <title>resume-tailor — tailor your resume to a job description, without lying</title>
    <meta name="description" content="resume-tailor is a free, open-source CLI and Claude Code/Copilot skill set that turns one JSON source of truth into an ATS-tailored resume for every job — never fabricating a skill or metric you don't have. Try the DOCX generator online, right now, no signup." />
    <meta property="og:title" content="resume-tailor" />
    <meta property="og:description" content="One JSON source of truth, tailored honestly to every job description. Deterministic DOCX/PDF output, no fabricated keywords, ever." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://subho57.github.io/resume-tailor/" />
    <link rel="canonical" href="https://subho57.github.io/resume-tailor/" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "resume-tailor",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "macOS, Linux, Windows (Beta)",
      "description": "Deterministic, schema-driven resume generator that tailors resumes to job descriptions without fabricating experience.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
    }
    </script>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>resume-tailor</h1>
      <p class="tagline">
        One hand-edited resume drifts across a dozen applications. Under pressure to match a job
        description, it's tempting to inflate a keyword you don't really have — that collapses in
        an interview. resume-tailor keeps one JSON source of truth and tailors it honestly to each
        job's own vocabulary: select and rephrase real experience, never invent it.
      </p>
      <img src="./infographic.svg" alt="Pipeline: JSON source of truth, validated, tailored without fabricating, autofit and rendered, to DOCX and PDF" class="infographic" />
      <p class="free-note">
        <strong>Entirely free.</strong> No account, no subscription — a static binary, plus the
        Claude Code or GitHub Copilot subscription you already have. <code>--install-skill</code>
        drops the tailoring workflow into your existing <code>~/.claude/skills/</code> or
        <code>~/.copilot/skills/</code>, whichever you already use.
      </p>
      <h2>Install</h2>
      <pre><code>curl -fsSL https://subho57.github.io/resume-tailor/install.sh | bash</code></pre>
      <p>macOS and Linux. Windows support is in <strong>Beta</strong> —
        <a href="https://github.com/subho57/resume-tailor/releases/latest/download/tailor-resume-windows-x64.zip">download the latest Windows build directly</a>.
      </p>
      <h2>Try it now — right in this page</h2>
      <p class="limitation-note">
        Runs entirely in your browser — nothing is uploaded. One difference from the
        CLI: if your JSON uses a <code>flagged: true</code> highlight (for
        reconciling conflicting facts), its Word comment may not render perfectly
        here, since the CLI's comment-repair step needs tools this page can't run.
        Everything else matches the CLI's output exactly.
      </p>
      <div class="controls">
```

- [ ] **Step 3: Create `site/public/sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://subho57.github.io/resume-tailor/</loc>
  </url>
</urlset>
```

- [ ] **Step 4: Create `site/public/robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://subho57.github.io/resume-tailor/sitemap.xml
```

- [ ] **Step 5: Build and verify**

```bash
cd site && bun run build
grep -c "og:title" dist/index.html
ls dist/sitemap.xml dist/robots.txt dist/infographic.svg
```
Expected: build exits 0; the grep finds the OG tag in the built HTML (confirms Vite processed `index.html`'s `<head>` correctly); all 3 files exist in `dist/` (Vite copies anything in `site/public/` to the dist root as-is, and bundles `<img src>`-referenced assets like `infographic.svg` automatically).

- [ ] **Step 6: Commit**

```bash
git add site/infographic.svg site/index.html site/public/sitemap.xml site/public/robots.txt
git commit -m "$(cat <<'EOF'
feat: add homepage copy, SVG infographic, and SEO metadata to site/

Problem-statement hero copy, the pipeline infographic, install
instructions with the Windows Beta direct-download link, OG/meta tags,
ld+json SoftwareApplication schema, sitemap.xml, robots.txt.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `install.sh`

**Files:**
- Create: `site/public/install.sh`

**Interfaces:**
- Consumes: `tailor-resume-<os>-<arch>.tar.gz` release assets at `github.com/subho57/resume-tailor/releases/latest/download/` (produced by Task 1's renamed release workflow — those assets don't exist until the next real release runs, but the script's URL construction is independently testable against the CURRENT `build-resume`-named assets from before the rename, by overriding the base URL — see Step 3).
- Produces: nothing consumed by other tasks in this plan — this is a leaf deliverable, served statically by Task 5's deploy workflow.

- [ ] **Step 1: Create `site/public/install.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="subho57/resume-tailor"
BASE_URL="${INSTALL_BASE_URL:-https://github.com/${REPO}/releases/latest/download}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
  Darwin) platform="macos" ;;
  Linux) platform="linux" ;;
  *)
    echo "error: unsupported OS '$os'. Windows support is in Beta — download the .zip manually:" >&2
    echo "  https://github.com/${REPO}/releases/latest/download/tailor-resume-windows-x64.zip" >&2
    exit 1
    ;;
esac

case "$arch" in
  x86_64|amd64) cpu="x64" ;;
  arm64|aarch64) cpu="arm64" ;;
  *)
    echo "error: unsupported architecture '$arch'." >&2
    exit 1
    ;;
esac

asset="tailor-resume-${platform}-${cpu}.tar.gz"
url="${BASE_URL}/${asset}"

echo "Downloading ${url} ..."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$url" -o "$tmp/$asset"
tar -xzf "$tmp/$asset" -C "$tmp"

mkdir -p "$INSTALL_DIR"
mv "$tmp/tailor-resume" "$INSTALL_DIR/tailor-resume"
chmod +x "$INSTALL_DIR/tailor-resume"
echo "Installed tailor-resume to ${INSTALL_DIR}/tailor-resume"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo ""
    echo "NOTE: ${INSTALL_DIR} is not on your PATH. Add this to your shell profile:"
    echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
    ;;
esac

echo ""
echo "Installing Claude Code / Copilot skills (jd-tailored-resume, master-resume-builder) ..."
"$INSTALL_DIR/tailor-resume" --install-skill

echo ""
echo "Checking PDF/autofit prerequisites (LibreOffice + Poppler + Carlito font) ..."
missing=()
command -v soffice >/dev/null 2>&1 || missing+=("soffice (LibreOffice)")
command -v pdfinfo >/dev/null 2>&1 || missing+=("pdfinfo (Poppler)")

if [ ${#missing[@]} -eq 0 ]; then
  echo "All prerequisites present."
else
  echo "Missing: ${missing[*]}"
  if [ "$platform" = "macos" ]; then
    if command -v brew >/dev/null 2>&1; then
      echo "Installing via brew ..."
      brew install --cask libreoffice
      brew install poppler
      brew install --cask font-carlito
    else
      echo "Homebrew not found. Install it first (https://brew.sh), then run:"
      echo "  brew install --cask libreoffice && brew install poppler && brew install --cask font-carlito"
    fi
  else
    if command -v apt >/dev/null 2>&1; then
      echo "Installing via apt (may prompt for sudo) ..."
      sudo apt install -y libreoffice poppler-utils fonts-crosextra-carlito
    elif command -v dnf >/dev/null 2>&1; then
      echo "Installing via dnf (may prompt for sudo) ..."
      sudo dnf install -y libreoffice poppler-utils crosextra-carlito-fonts
    elif command -v brew >/dev/null 2>&1; then
      echo "No apt/dnf found; Homebrew is present but its Linux --cask support is limited for LibreOffice."
      echo "Try: brew install libreoffice poppler — if that fails, install LibreOffice via your distro's package manager instead."
    else
      echo "No apt, dnf, or brew found. Install LibreOffice, Poppler, and the Carlito font manually for your distro."
    fi
  fi
fi

echo ""
echo "Done. Run 'tailor-resume --version' to confirm."
```

- [ ] **Step 2: Make it executable and lint it**

```bash
chmod +x site/public/install.sh
bash -n site/public/install.sh
```
Expected: `bash -n` (syntax check only, doesn't execute) exits 0 with no output.

- [ ] **Step 3: Functional test against the CURRENT (pre-rename-release) assets**

The renamed `tailor-resume-*` release assets won't exist until a real release runs after Task 1 merges. Test the script's actual download/extract/install logic now against the last real release's `build-resume`-named assets by overriding the URL:

```bash
INSTALL_DIR=/tmp/tailor-resume-install-test INSTALL_BASE_URL="https://github.com/subho57/resume-tailor/releases/latest/download" bash -c '
  set -e
  asset="build-resume-$(uname -s | tr "[:upper:]" "[:lower:]" | sed "s/darwin/macos/")-$(uname -m | sed "s/x86_64/x64/;s/aarch64/arm64/").tar.gz"
  echo "would fetch: $INSTALL_BASE_URL/$asset (manually verify this asset name exists in the latest release before trusting the script end-to-end)"
'
mkdir -p /tmp/tailor-resume-install-test
curl -fsSL "https://github.com/subho57/resume-tailor/releases/latest/download/build-resume-macos-arm64.tar.gz" -o /tmp/tailor-resume-install-test/test.tar.gz 2>&1 | tail -5
tar -tzf /tmp/tailor-resume-install-test/test.tar.gz
```
Expected: the `curl` succeeds (confirms the repo's public visibility actually allows anonymous download — this is the real, load-bearing check for Task 1's visibility change) and `tar -tzf` lists a single file named `build-resume`. Once a real release has run after Task 1 merges and produced `tailor-resume-*` assets, re-run the full `install.sh` (not just this manual curl) end-to-end on a real macOS machine and a real Linux container/VM — once with `brew`/`apt` present, once without — before considering this task truly done; this manual curl check only proves the download mechanics work today, not the full script.

- [ ] **Step 4: Commit**

```bash
git add site/public/install.sh
git commit -m "$(cat <<'EOF'
feat: add install.sh for macOS/Linux CLI + skill installation

Detects OS/arch, downloads the matching tailor-resume release asset,
installs to ~/.local/bin, runs --install-skill, and checks/installs
PDF-toolchain prerequisites (brew on macOS, apt/dnf on Linux with brew
as a documented fallback). Windows explicitly rejected with a pointer
to the manual .zip download. Verified against the current, pre-rename
release assets that anonymous curl now succeeds against the public repo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `deploy-pages.yml` workflow + Pages settings switch

**Files:**
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: `site/package.json`'s `build` script (Task 2) and everything Task 2-4 added under `site/`.
- Produces: the live Pages deployment — no later task in this plan depends on it, but this is what makes every other task's output (the demo, the infographic, `install.sh`, the SEO tags) actually reachable at `https://subho57.github.io/resume-tailor/`.

- [ ] **Step 1: Create `.github/workflows/deploy-pages.yml`**

```yaml
name: Deploy Pages

on:
  push:
    branches: [main]
    paths:
      - "site/**"
      - "src/render.ts"
      - "src/theme.ts"
      - "src/validate.ts"
      - "src/types.ts"
      - "schema/**"
      - "themes/**"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7

      - uses: actions/configure-pages@v6

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install and build site/
        working-directory: site
        run: |
          bun install
          bun run build

      - uses: actions/upload-pages-artifact@v5
        with:
          path: site/dist

      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Validate the workflow YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-pages.yml'))" && echo "YAML valid"
```
Expected: `YAML valid`.

- [ ] **Step 3: Switch the repo's Pages source to GitHub Actions**

This is a one-time repo-settings change, not something the workflow itself can do. Without it, the workflow will fail at the `deploy-pages` step with an error that Pages isn't configured for Actions deployment.

```bash
gh api -X PUT repos/subho57/resume-tailor/pages -f build_type=workflow
gh api repos/subho57/resume-tailor/pages | grep build_type
```
Expected: the second command prints `"build_type": "workflow"` (was `"legacy"`, serving `main:/`, before this change).

- [ ] **Step 4: Commit and push, then verify the live deployment**

```bash
git add .github/workflows/deploy-pages.yml
git commit -m "$(cat <<'EOF'
feat: add GitHub Actions Pages deployment workflow for site/

Builds site/ with Bun/Vite and deploys via the official
actions/upload-pages-artifact + actions/deploy-pages, triggered on
pushes touching site/ or the 4 reused renderer files. Requires the
one-time repo Pages-source switch to "GitHub Actions" (done as part
of this task, not automatic) — this also means Pages now serves only
the built site artifact, never the raw repo tree, closing the original
"whole repo reachable via the Pages URL" gap for good (moot for PII
purposes now that the repo itself is public, but still the correct
end state regardless of visibility).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

Then, after the workflow run completes (check with `gh run list --workflow=deploy-pages.yml --limit 1`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://subho57.github.io/resume-tailor/
curl -s -o /dev/null -w "%{http_code}\n" https://subho57.github.io/resume-tailor/install.sh
curl -s -o /dev/null -w "%{http_code}\n" https://subho57.github.io/resume-tailor/data/priyanka.resume.json
```
Expected: the first two return `200`; the third returns `404` — confirming Pages now serves only `site/dist/`'s contents, not the repo root (this is the concrete proof that the original exposure pattern is closed, independent of the repo's own visibility).
