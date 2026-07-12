// Reads the real .claude/skills/jd-tailored-resume/ directory and generates
// src/skill-bundle.generated.ts — a plain Record<string, string> of file contents,
// embedded into the CLI so `--install-skill` can write a standalone variant of this
// skill to ~/.claude/skills/jd-tailored-resume/ (used by `build-resume` directly,
// no repo checkout required).
//
// A plain-data TS module (not `with { type: "file" }` imports) is used deliberately:
// this repo has two build paths for src/cli.ts — `tsc` (-> dist/cli.js, run via
// `bun dist/cli.js`) and `bun build --compile` (-> the standalone binary). Bun's file-
// embedding import attributes only work cleanly through Bun's own bundler/runtime;
// tsc has no concept of them and would either fail to resolve `.md`/`.py` "modules"
// or emit a plain `require(...)` that means nothing outside Bun's bundler-time
// transform. A Record<string,string> of string constants is ordinary TS that both
// toolchains handle identically.
//
// SKILL.md gets 5 anchor-replaced regions (repo/bun instructions -> standalone
// `build-resume` instructions); everything else in SKILL.md, plus
// references/tailoring-guide.md and scripts/check_keywords.py, are embedded verbatim
// (neither has any repo-path or `bun` assumptions — verified by inspection).
//
// assertReplace fails the whole build (not silently no-ops) if SKILL.md changes in a
// way that moves/rewords one of these anchors — update the transform below when that
// happens, don't bypass it.

import * as fs from "fs";
import * as path from "path";

const repoRoot = path.resolve(import.meta.dir, "..");
const skillDir = path.join(repoRoot, ".claude", "skills", "jd-tailored-resume");
const outPath = path.join(repoRoot, "src", "skill-bundle.generated.ts");

function assertReplace(content: string, oldText: string, newText: string, label: string): string {
  const count = content.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(
      `generate-skill-bundle: expected exactly 1 occurrence of the "${label}" anchor in SKILL.md, found ${count}.\n` +
      `SKILL.md's structure changed — update the transform in scripts/generate-skill-bundle.ts to match.\n` +
      `Anchor (first 200 chars):\n${oldText.slice(0, 200)}...`
    );
  }
  return content.replace(oldText, newText);
}

function transformSkillMd(content: string): string {
  content = assertReplace(
    content,
    `## Where this skill lives

This is a **project skill** committed inside the \`resume-system\` repository at
\`.claude/skills/jd-tailored-resume/\`. The generator it drives (CLI, schema, themes, and
the candidate's superset JSON) is the surrounding repo itself — **not** a bundled copy.
From this skill's directory, the **repo root is three levels up**: \`../../../\`. Every
path below is written relative to the repo root on that basis. If you run commands from
the repo root instead (the usual case in Claude Code), drop the \`../../../\` prefix and
use the plain paths (\`dist/cli.js\`, \`data/…\`, \`.claude/skills/jd-tailored-resume/scripts/…\`).`,
    `## Where this skill lives

This is a **personal skill** installed at \`~/.claude/skills/jd-tailored-resume/\` by
the standalone \`build-resume\` CLI binary (\`build-resume --install-skill\`) — there is
no surrounding repo to check out or build. \`build-resume\` has both shipped theme
presets (\`corporate-navy\`, \`slate-compact\`) and both JSON schemas embedded directly;
you only need the candidate's own superset ground-truth JSON, supplied as a path
wherever you invoke this skill from.`,
    "Where this skill lives"
  );

  content = assertReplace(
    content,
    `2. **The superset JSON** — the ground-truth resume data. Look for it in this order:
   a file the user names; then \`data/*.resume.json\` in the repo root (e.g.
   \`data/priyanka.resume.json\`); otherwise ask the user for the path. This is the ONLY
   source of factual content.
3. **(Optional) a theme name** — defaults to \`corporate-navy\` (see \`themes/\` in the repo).`,
    `2. **The superset JSON** — the ground-truth resume data. A file the user names or
   points you to; if not given, ask for the path. There's no repo \`data/\` folder to
   fall back on here — this is the ONLY source of factual content, and you cannot
   proceed without it.
3. **(Optional) a theme name** — defaults to \`corporate-navy\`. Both shipped presets
   (\`corporate-navy\`, \`slate-compact\`) are built into \`build-resume\` itself; no file
   lookup needed.`,
    "Inputs you need (superset JSON / theme name)"
  );

  content = assertReplace(
    content,
    `Produce a **new** JSON conforming to the same schema the superset uses
(\`schema/resume.schema.json\` in the repo root). Rules:`,
    `Produce a **new** JSON conforming to the same schema the superset uses
(the \`resume.schema.json\` structure — embedded in \`build-resume\`, no file lookup
needed). Rules:`,
    "Write the tailored JSON (schema reference)"
  );

  content = assertReplace(
    content,
    `### 7. Render with the CLI

The \`resume-system\` repo (the folder this skill lives in) renders JSON → DOCX + PDF
deterministically. **Run these from the repo root** — in Claude Code the working
directory is the project root, so the plain paths below just work.

\`\`\`bash
# one-time, only if dist/ is missing or docx can't be resolved:
bun install && bun run build

# render (single-page is the default expectation for a tailored resume):
bun dist/cli.js \\
  --content <output_folder>/<FileName>.resume.json \\
  --theme corporate-navy \\
  --out <output_folder> \\
  --basename "<FileName>" \\
  --one-pager \\
  --keywords "<comma,separated,confirmed,terms,from,step,4>"
\`\`\`

Always use \`bun\`, not \`node\`, to run the CLI: \`package.json\` sets \`"type": "module"\`
but the compiled output is CommonJS, so plain Node throws \`ReferenceError: exports is
not defined in ES module scope\`. Bun runs it fine regardless.

If for some reason you are running from *inside* the skill directory instead of the
repo root, prefix repo paths with \`../../../\` (e.g. \`bun ../../../dist/cli.js …\`).

Note: \`dist/\` and \`out/\` are gitignored (not committed) — run the install/build above
after a fresh clone or any \`src/\` change; there's no prebuilt \`dist/\` to fall back on.
The CLI needs LibreOffice + \`pdfinfo\` for PDF/autofit; if those are unavailable it
still writes the DOCX and warns, naming exactly what's missing.`,
    `### 7. Render with the CLI

\`build-resume\` is a standalone binary — no repo, no install/build step, no \`bun\`.

\`\`\`bash
build-resume \\
  --content <output_folder>/<FileName>.resume.json \\
  --theme corporate-navy \\
  --out <output_folder> \\
  --basename "<FileName>" \\
  --one-pager \\
  --keywords "<comma,separated,confirmed,terms,from,step,4>"
\`\`\`

The CLI needs LibreOffice + \`pdfinfo\` on PATH for PDF/autofit; if those are
unavailable it still writes the DOCX and warns, naming exactly what's missing and how
to install it.`,
    "Render with the CLI"
  );

  content = assertReplace(
    content,
    `Run the bundled checker against the JD and the rendered resume (from the repo root):

\`\`\`bash
python .claude/skills/jd-tailored-resume/scripts/check_keywords.py \\
  --jd <jd.txt> --resume <output_folder>/<FileName>.pdf
\`\`\``,
    `Run the bundled checker against the JD and the rendered resume:

\`\`\`bash
python ~/.claude/skills/jd-tailored-resume/scripts/check_keywords.py \\
  --jd <jd.txt> --resume <output_folder>/<FileName>.pdf
\`\`\``,
    "Verify keyword coverage (check_keywords.py path)"
  );

  content = assertReplace(
    content,
    `Put everything in a dedicated folder, e.g. \`output/\` at the repo root (create it if
needed). The CLI writes both`,
    `Put everything in a dedicated folder, e.g. \`./output/\` relative to wherever you're
working (create it if needed). The CLI writes both`,
    "Output naming (output folder location)"
  );

  content = assertReplace(
    content,
    `## Files in this skill

This skill directory (\`.claude/skills/jd-tailored-resume/\`) contains:

- \`SKILL.md\` — this workflow.
- \`references/tailoring-guide.md\` — how to read a JD, frame by role family, and rephrase
  honestly, with examples. Read it when you need the detail behind steps 1–6.
- \`scripts/check_keywords.py\` — the keyword-coverage verifier used in step 8.
- \`evals/evals.json\` — sample test prompts for the skill.

The generator it drives lives in the **surrounding repo** (\`resume-system/\`, the repo
root three levels up): \`dist/\` (compiled CLI), \`src/\` (TypeScript source), \`schema/\`
(content + theme JSON Schemas), \`themes/\` (theme presets), and \`data/\` (the candidate's
superset ground-truth JSON). See the repo's \`README.md\` for details on the generator.`,
    `## Files in this skill

This skill directory (\`~/.claude/skills/jd-tailored-resume/\`) contains:

- \`SKILL.md\` — this workflow.
- \`references/tailoring-guide.md\` — how to read a JD, frame by role family, and rephrase
  honestly, with examples. Read it when you need the detail behind steps 1–6.
- \`scripts/check_keywords.py\` — the keyword-coverage verifier used in step 8.

The generator it drives is the standalone \`build-resume\` binary — themes and schemas
are embedded in it directly; only the candidate's own superset JSON needs to be
supplied externally. Run \`build-resume --help\` for the full flag list.`,
    "Files in this skill"
  );

  return content;
}

function main() {
  const skillMdRaw = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
  const tailoringGuide = fs.readFileSync(path.join(skillDir, "references", "tailoring-guide.md"), "utf-8");
  const checkKeywordsPy = fs.readFileSync(path.join(skillDir, "scripts", "check_keywords.py"), "utf-8");

  const bundle: Record<string, string> = {
    "SKILL.md": transformSkillMd(skillMdRaw),
    "references/tailoring-guide.md": tailoringGuide,
    "scripts/check_keywords.py": checkKeywordsPy,
  };

  const entries = Object.entries(bundle)
    .map(([rel, content]) => `  ${JSON.stringify(rel)}: ${JSON.stringify(content)},`)
    .join("\n");

  const output = `// AUTO-GENERATED by scripts/generate-skill-bundle.ts — do not edit by hand.\n` +
    `// Regenerated by \`bun run prepare-skill\` (also run automatically by the build/compile scripts).\n` +
    `export const SKILL_BUNDLE: Record<string, string> = {\n${entries}\n};\n`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output, "utf-8");
  console.log(`✓ Generated ${path.relative(repoRoot, outPath)} (${Object.keys(bundle).length} files)`);
}

main();
