// Reads the real .claude/skills/<name>/ directories and generates
// src/skill-bundle.generated.ts — SKILL_BUNDLES, a Record<skillName, Record<relPath,
// content>>, embedded into the CLI so `--install-skill [name]` can write standalone
// variants of these skills to ~/.claude/skills/<name>/ (used by `tailor-resume`
// directly, no repo checkout required).
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
// Each skill's SKILL.md gets its own set of anchor-replaced regions (repo/bun
// instructions -> standalone `tailor-resume` instructions); everything else in
// SKILL.md, plus any references/ or scripts/ files, are embedded verbatim.
//
// assertReplace fails the whole build (not silently no-ops) if a SKILL.md changes in
// a way that moves/rewords one of its anchors — update the matching transform below
// when that happens, don't bypass it.
//
// To add a new bundled skill: add an entry to SKILLS below with its own transform
// function (or `(c) => c` if it has no repo-specific anchors), then re-run
// `bun run prepare-skill`.

import { mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const outPath = join(repoRoot, "src", "skill-bundle.generated.ts");

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

function transformJdTailoredResumeSkillMd(content: string): string {
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
the standalone \`tailor-resume\` CLI binary (\`tailor-resume --install-skill\`) — there is
no surrounding repo to check out or build. \`tailor-resume\` has both shipped theme
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
   (\`corporate-navy\`, \`slate-compact\`) are built into \`tailor-resume\` itself; no file
   lookup needed.`,
    "Inputs you need (superset JSON / theme name)"
  );

  content = assertReplace(
    content,
    `Produce a **new** JSON conforming to the same schema the superset uses
(\`schema/resume.schema.json\` in the repo root). Rules:`,
    `Produce a **new** JSON conforming to the same schema the superset uses
(the \`resume.schema.json\` structure — embedded in \`tailor-resume\`, no file lookup
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

\`tailor-resume\` is a standalone binary — no repo, no install/build step, no \`bun\`.

\`\`\`bash
tailor-resume \\
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

The generator it drives is the standalone \`tailor-resume\` binary — themes and schemas
are embedded in it directly; only the candidate's own superset JSON needs to be
supplied externally. Run \`tailor-resume --help\` for the full flag list.`,
    "Files in this skill"
  );

  return content;
}

function transformMasterResumeBuilderSkillMd(content: string): string {
  content = assertReplace(
    content,
    `## Where this skill lives

This is a **project skill** committed inside the \`resume-system\` repository at
\`.claude/skills/master-resume-builder/\`. The schema and CLI it targets are the
surrounding repo itself — **not** a bundled copy. From this skill's directory, the
repo root is three levels up: \`../../../\`. Paths below are written relative to the
repo root; if running from the repo root (the usual case), drop the \`../../../\`
prefix.`,
    `## Where this skill lives

This is a **personal skill** installed at \`~/.claude/skills/master-resume-builder/\`
by the standalone \`tailor-resume\` CLI binary (\`tailor-resume --install-skill
master-resume-builder\`) — there is no surrounding repo to check out or build.
\`tailor-resume\` has the resume content schema embedded directly; you only need the
candidate's raw material and an output path, supplied wherever you invoke this skill
from.`,
    "Where this skill lives"
  );

  content = assertReplace(
    content,
    `   shows up (e.g. \`.docx\`), convert it first: \`soffice --headless --convert-to txt:Text <file>\`
   (LibreOffice is already a repo prerequisite — see README's "Prerequisites") or
   ask the user to paste the content.
2. **The candidate's full name**, and enough context (current/most recent employer,
   location, field) to distinguish them from unrelated people of the same name in
   web search results.
3. **Where to write the output** — default to \`data/<firstname-lastname>.resume.json\`
   in the repo root unless the user names a different path.`,
    `   shows up (e.g. \`.docx\`), convert it first: \`soffice --headless --convert-to txt:Text <file>\`
   (LibreOffice is required for \`tailor-resume\`'s PDF/autofit too — install it if
   missing) or ask the user to paste the content.
2. **The candidate's full name**, and enough context (current/most recent employer,
   location, field) to distinguish them from unrelated people of the same name in
   web search results.
3. **Where to write the output** — ask the user for an output path. There's no repo
   \`data/\` folder to default into here.`,
    "Inputs you need (raw files / output path)"
  );

  content = assertReplace(
    content,
    `\`\`\`bash
bun install && bun run build   # one-time, if dist/ is missing
bun dist/cli.js --content data/<firstname-lastname>.resume.json
\`\`\``,
    `\`\`\`bash
tailor-resume --content <output_path>.resume.json
\`\`\``,
    "Validate and render (CLI invocation)"
  );

  content = assertReplace(
    content,
    `## Files in this skill

This skill directory (\`.claude/skills/master-resume-builder/\`) contains:

- \`SKILL.md\` — this workflow.
- \`references/research-guide.md\` — search patterns for companies and identity
  cross-referencing, the reconciliation worked example, and the fabricated-date
  trap in detail.

The generator it feeds lives in the **surrounding repo** (\`resume-system/\`, the
repo root three levels up): \`schema/resume.schema.json\` (the target schema),
\`dist/\`/\`src/\` (the CLI that validates and renders the output), and \`data/\` (where
the finished superset JSON lives alongside other candidates' ground-truth docs).`,
    `## Files in this skill

This skill directory (\`~/.claude/skills/master-resume-builder/\`) contains:

- \`SKILL.md\` — this workflow.
- \`references/research-guide.md\` — search patterns for companies and identity
  cross-referencing, the reconciliation worked example, and the fabricated-date
  trap in detail.

The generator it feeds is the standalone \`tailor-resume\` binary — the resume content
schema is embedded in it directly; only the raw material and an output path need to
be supplied externally. Run \`tailor-resume --help\` for the full flag list.`,
    "Files in this skill"
  );

  return content;
}

interface SkillSpec {
  name: string;
  transformSkillMd: (content: string) => string;
  extraFiles: string[]; // relative paths beyond SKILL.md, embedded verbatim
}

const SKILLS: SkillSpec[] = [
  {
    name: "jd-tailored-resume",
    transformSkillMd: transformJdTailoredResumeSkillMd,
    extraFiles: ["references/tailoring-guide.md", "scripts/check_keywords.py"],
  },
  {
    name: "master-resume-builder",
    transformSkillMd: transformMasterResumeBuilderSkillMd,
    extraFiles: ["references/research-guide.md"],
  },
];

// GitHub Copilot CLI's SKILL.md format is the same as Claude Code's (YAML
// frontmatter with name/description; unknown fields are tolerated, not rejected —
// confirmed by inspecting ~/.copilot's own installed CLI bundle, not assumed). Its
// project-skill discovery already includes `.claude/skills/` as a fallback source
// (alongside `.github/skills/` and `.agents/skills/`), so no repo-committed
// `.copilot/skills/` mirror is needed or read at project scope. Its *personal*
// (home-directory) skill source is `~/.copilot/skills/`, which IS distinct from
// Claude's `~/.claude/skills/` — that's the only place a Copilot-specific variant
// is actually useful, so the derivation below only swaps the home-directory path
// mentioned in the standalone doc's prose. (An earlier version of this also
// injected a `trigger: /<name>` frontmatter field, believing it bound a Copilot
// slash command — that field doesn't exist in Copilot's schema; it was a
// misreading of an unrelated internal telemetry enum of the same name. Removed.)
function deriveCopilotSkillMd(_skillName: string, claudeStandaloneSkillMd: string): string {
  return claudeStandaloneSkillMd.split(".claude/skills").join(".copilot/skills");
}

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

  // 1. Embed both targets' bundles into the CLI for `tailor-resume --install-skill`
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
