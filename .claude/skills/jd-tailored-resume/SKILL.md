---
name: jd-tailored-resume
description: >-
  Reverse-engineer a job description into a tailored, ATS-optimized resume. Given a
  JD (a text file, pasted text, or a link the user provides), extract the role's
  keywords and priorities, then SELECT, REPHRASE, and REORDER content from a
  candidate's superset "ground-truth" resume JSON to produce a new tailored JSON,
  render it to DOCX + PDF via the bundled CLI, and verify the JD's key terms are
  consistently present in the resume. Use this skill whenever the user wants to
  tailor, customize, target, or generate a resume/CV for a specific job, role, or
  company, or mentions a job description, JD, job posting, or "make my resume match
  this job" — even if they don't say the word "resume." Produces one output file per
  JD, named after the role/company, in a dedicated output folder.
---

# JD-Tailored Resume Builder

Turn a job description into a resume — **by reverse-engineering the JD**, not by
starting from a generic resume and hoping it fits. The JD tells you what the employer
is screening for; your job is to surface the candidate's genuine, matching experience
in the JD's own language, so both a human reader and an ATS see the alignment
immediately.

The candidate's full history lives in a **superset "ground-truth" JSON** — a
comprehensive data dump with far more content than any single resume should show
(every bullet variant, every skill, multiple summary framings, flagged alternate
values). You never invent facts; you *select and rephrase* from this superset.

## The core principle: honest keyword alignment

The goal is that **terms the JD emphasizes appear in the resume — but only where the
candidate genuinely has that experience.** This is the entire ethic of the skill:

- If the JD says "gRPC" and the superset shows gRPC work → make sure the resume says
  "gRPC" (in those words, not a paraphrase the ATS won't match).
- If the JD says "Kubernetes (expert)" and the superset only shows "working knowledge"
  → represent it honestly as working knowledge; do not inflate it.
- If the JD wants "Kotlin" and the superset has no Kotlin → **leave it out.** A missing
  keyword is an honest gap. A fabricated one is a liability that collapses in an
  interview and misrepresents the candidate.

Keyword *alignment* means using the candidate's real experience and matching the JD's
vocabulary where the two overlap. It is never keyword *stuffing*.

## Where this skill lives

This is a **project skill** committed inside the `resume-system` repository at
`.claude/skills/jd-tailored-resume/`. The generator it drives (CLI, schema, themes, and
the candidate's superset JSON) is the surrounding repo itself — **not** a bundled copy.
From this skill's directory, the **repo root is three levels up**: `../../../`. Every
path below is written relative to the repo root on that basis. If you run commands from
the repo root instead (the usual case in Claude Code), drop the `../../../` prefix and
use the plain paths (`dist/cli.js`, `data/…`, `.claude/skills/jd-tailored-resume/scripts/…`).

## Inputs you need

1. **The JD** — a text file path, pasted text, or content the user supplies. If given a
   URL, ask the user to paste the text (JD pages are often behind logins/JS).
2. **The superset JSON** — the ground-truth resume data. Look for it in this order:
   a file the user names; then `data/*.resume.json` in the repo root (e.g.
   `data/priyanka.resume.json`); otherwise ask the user for the path. This is the ONLY
   source of factual content.
3. **(Optional) a theme name** — defaults to `corporate-navy` (see `themes/` in the repo).

If the superset JSON is missing, stop and ask for it — you cannot tailor without the
ground truth, and you must not invent content to fill the gap.

## Workflow

Follow these steps in order. Steps 1–4 are analysis; 5 confirms multi-role display; 6
writes the tailored JSON; 7 renders; 8 verifies; 9 reports.

### 1. Read and reverse-engineer the JD

Read the JD closely and extract, in your own working notes:

- **Role & seniority** (e.g. "Senior Backend Engineer", "SDE-2") and the **target role
  family** if the superset declares preferences (Golang vs Node.js vs Python/AI).
- **Hard requirements vs. nice-to-haves** — languages, frameworks, cloud, databases,
  domains. Note which are repeated or listed first; repetition signals priority.
- **Exact keyword phrasing** — capture the JD's literal terms ("event-driven",
  "CI/CD", "REST APIs", "distributed systems"). ATS matching is literal, so the resume
  should echo the JD's spelling/casing where the candidate's experience supports it.
- **Domain & tone** — fintech vs. security vs. devtools; what the team values.

For a structured extraction routine and how to weight terms, read
`references/tailoring-guide.md` (§"Reading a JD").

### 2. Choose the framing

Pick the **summary variant** from the superset's `basics.summaries` that best matches
the JD (e.g. the "golang" or "ai" variant), and set it as the active summary. Decide
the **section order** and which of the superset's roles/bullets/skills to foreground.
Backend/distributed roles lead with databases, event-driven systems, production
fixes; AI/agentic roles lead with MCP, multi-agent, LLM tooling. See
`references/tailoring-guide.md` (§"Framing by role family").

### 3. Select content from the superset

For each section, choose the subset that matches the JD:

- **Skills**: keep groups/keywords the JD cares about; you may drop groups irrelevant
  to this role. Preserve the candidate's real items — don't add unlisted tools.
- **Work highlights**: from each company's full bullet list in the superset, pick the
  handful most relevant to the JD. A one-page resume typically shows 4–6 bullets for
  the main role, fewer for older ones.
- **Projects / open-source / education**: include what reinforces the JD; a tailored
  resume usually omits the ground-truth-only sections (preferences, companyContext,
  the full recommendations list, beginner certifications).
- **Every kept skill keyword needs a visible backer.** If a keyword's only evidence in
  the superset lives in a company/project/internship you'd otherwise cut for space or
  relevance, don't just drop the source and keep the keyword floating alone in the
  Skills list — that reads as inflated even though it's technically true. Instead,
  greedily pull a short, honestly-rephrased line forward from that source (see the
  compact-entry pattern below) or drop the keyword. See step 4.

**Compact-entry pattern** for a keyword whose only backing is a small, old, or
otherwise-cut role: add it as a normal, minimal `work[]` entry, not a labeled aside.
Use the real company name in `name` (never prefix it with editorial text like
"Additional Experience:" — that field is what ATS parsers read as the employer name,
and decorating it breaks that parse), a compact `dateDisplay` (e.g. `"2021"`), the
real `position` if it adds clarity, and exactly one trimmed highlight — no
`domainNote`, no multi-bullet list. Example:
```json
{ "name": "Kredey", "dateDisplay": "2021", "position": "Full-Stack Website Developer (Intern)",
  "highlights": ["Used Elasticsearch to support full-text and semantic search over a NoSQL Firebase-backed document-sharing platform."] }
```
Real company, real tech, no invented scope, no decorative labeling — it reads to both
a human and an ATS as an ordinary (if brief) work-history entry.

### 4. Map JD keywords to real evidence

Build a quick mental (or written) map: JD term → where the candidate demonstrates it in
the superset. This map drives step 6. Any JD term with **no** entry in the map is a
gap — record it, do not fabricate it. Any term WITH evidence must make it into the
resume text — and not just as a bare Skills-list entry.

**Before finalizing, re-check every kept keyword against the map's source, not just
the term's presence.** If evidence for a keyword lives ONLY in a company, project, or
internship you're excluding from the tailored resume, you have two options, not one:
1. **Pull a line forward** — greedily surface a short, honestly-rephrased bullet, via
   the compact-entry pattern (step 3), from that source into the resume, so the
   keyword has a visible backer.
2. **Drop the keyword** — if it's not worth the space, don't keep it in Skills either.

Never do the third thing: keep the keyword in Skills while cutting the only bullet
that proves it. That's how a resume ends up with a claim that looks unsupported to a
human reviewer even though it's technically true — worse than an honest gap, because
it invites a follow-up question the candidate can only half-answer.

**Collect the confirmed list for bolding.** As you finalize the map, keep a running,
comma-separated list of the JD terms that ARE confirmed (evidence-backed, actually
going into the resume text) — this becomes the `--keywords` value in step 7. Only
confirmed matches go in this list, never gaps: a missing term won't match anything in
the rendered text anyway, but keep the list itself honest, not a wishlist.

### 5. Confirm presentation choices (ASK THE USER)

A few presentation decisions are judgment calls that belong to the candidate, not to
you — so **you must ask explicitly before rendering. Do not silently pick.** If the
user already stated a preference earlier in the conversation, honor it without
re-asking.

**Company descriptions (`domainNote`).** The superset stores a one-line italic
descriptor of what some companies do in `work[].domainNote`. It renders as a standalone
italic line *between* the company-header line and the role/title line, which can break
how ATS parsers associate company → title → dates. **Whenever any company you're
keeping carries a `domainNote`, ask the user once, globally:** keep the company
descriptions, or omit them for cleaner ATS parsing? Frame **omit as the recommended
default.** Apply the answer to *every* entry — all or none, don't mix — by including or
dropping the `domainNote` field when you write the tailored JSON (step 6).

**Role display for multi-role companies.** Some companies in the superset have **more
than one role** (e.g. an intern-to-engineer progression stored as two entries in
`work[].roles`). For **each** company that has 2+ roles, ask the user which treatment
they want (the `roleDisplay` field on that company controls it):

- **`senior-only` — "continued role"**: show only the most-senior title (the first
  entry in `roles`), spanning the company's full date range, and drop the junior
  line(s). Example: just *"Software Engineer I · August 2022 – April 2026"* instead of
  listing the intern stint separately. This is the most common choice for a clean
  one-page resume.
- **`separate`**: keep each role on its own line with its own dates (shows the explicit
  progression; this is the schema default if unset).
- **`combined`**: join the titles on one line over the full span, e.g. *"Software
  Engineer I / Junior Software Developer Intern · August 2022 – April 2026"*.

Ask concisely, once, listing the affected company/companies and their roles, and offer
these three options with `senior-only` framed as the usual pick. Wait for the user's
answer, then set `roleDisplay` accordingly on each such company in the tailored JSON. A
company with a single role needs no role-display question.

### 6. Write the tailored JSON

Produce a **new** JSON conforming to the same schema the superset uses
(`schema/resume.schema.json` in the repo root). Rules:

- **Rephrase toward the JD's vocabulary, preserving truth.** If the superset bullet
  says "moved 35+ modules from polling to push-based eventing" and the JD says
  "event-driven architecture", the tailored bullet can read
  "…re-architected 35+ modules to an event-driven model…". Same fact, JD's words.
- **Never change numbers, dates, employers, or claims.** Rephrasing is about wording
  and emphasis, not invention. Keep flagged/canonical values as the superset has them
  (e.g. CGPA exactly as stored).
- Set `basics.activeSummary` to your chosen variant.
- Set `sectionOrder` to your chosen order.
- Set `roleDisplay` on each multi-role company per the user's answer in step 5.
- Include or drop each company's `domainNote` per the user's answer in step 5 (all-or-none).
- Include a realistic contact block from the superset's `basics`.
- Write it to the output folder (see step 7) as the tailored source.

For a concrete before/after of honest rephrasing, read
`references/tailoring-guide.md` (§"Rephrasing examples").

### 7. Render with the CLI

The `resume-system` repo (the folder this skill lives in) renders JSON → DOCX + PDF
deterministically. **Run these from the repo root** — in Claude Code the working
directory is the project root, so the plain paths below just work.

```bash
# one-time, only if dist/ is missing or docx can't be resolved:
bun install && bun run build

# render (single-page is the default expectation for a tailored resume):
bun dist/cli.js \
  --content <output_folder>/<FileName>.resume.json \
  --theme corporate-navy \
  --out <output_folder> \
  --basename "<FileName>" \
  --one-pager \
  --keywords "<comma,separated,confirmed,terms,from,step,4>"
```

Always use `bun`, not `node`, to run the CLI: `package.json` sets `"type": "module"`
but the compiled output is CommonJS, so plain Node throws `ReferenceError: exports is
not defined in ES module scope`. Bun runs it fine regardless.

If for some reason you are running from *inside* the skill directory instead of the
repo root, prefix repo paths with `../../../` (e.g. `bun ../../../dist/cli.js …`).

Note: `dist/` and `out/` are gitignored (not committed) — run the install/build above
after a fresh clone or any `src/` change; there's no prebuilt `dist/` to fall back on.
The CLI needs LibreOffice + `pdfinfo` for PDF/autofit; if those are unavailable it
still writes the DOCX and warns, naming exactly what's missing.

`--keywords` bolds the confirmed terms from step 4 wherever they occur in the Summary,
Work-experience bullets, and Projects (case-insensitive; punctuation-safe, so terms
like "CI/CD" match correctly). It's optional — omit it to render without any bolding.

**Output naming** — name the file after the JD so outputs don't collide. Use:
`<CandidateLast>_<Company>_<Role>` with spaces→underscores, e.g.
`Chatterjee_Stripe_Backend_Engineer`. If the company is unknown, use the role alone.
Put everything in a dedicated folder, e.g. `output/` at the repo root (create it if
needed). The CLI writes both `<FileName>.docx` and `<FileName>.pdf` there; keep the
`<FileName>.resume.json` alongside them so the tailoring is reproducible.

### 8. Verify keyword coverage

Run the bundled checker against the JD and the rendered resume (from the repo root):

```bash
python .claude/skills/jd-tailored-resume/scripts/check_keywords.py \
  --jd <jd.txt> --resume <output_folder>/<FileName>.pdf
```

(You can also point `--resume` at the tailored `.json`.) The report lists **present**
and **missing** JD keywords. For each MISSING term:

- If the candidate genuinely has it (it's in the superset) → go back to step 6, surface
  it (pull the relevant bullet/skill or rephrase one to use the JD's exact term), and
  re-render. Iterate until real overlaps are covered.
- If it's not in the superset → leave it missing and note it in your report as an
  honest gap. Do **not** add it.

Also confirm the resume is the expected length (usually one page — the autofit flag
handles this and warns if it can't fit; if it warns, trim bullets rather than shrink
into unreadability).

### 9. Report to the user

Summarize concisely:
- The file(s) produced and where.
- Which JD priorities you emphasized and the framing/summary you chose.
- Keyword coverage (e.g. "18/20 JD terms present").
- **Honest gaps**: JD terms the candidate doesn't demonstrate, listed plainly, with a
  one-line note that these were intentionally not fabricated.
- Any judgment calls (e.g. represented Kubernetes as "working knowledge" per the
  ground truth despite the JD asking for more).
- Any keyword you backed with a pulled-forward compact work entry rather than a full
  work-experience block — say which company/keyword and why (step 4).

## Guardrails (do not violate)

- **Never fabricate or inflate.** No skills, tools, employers, dates, metrics, or
  seniority that the superset doesn't support. This protects the candidate.
- **Rephrasing preserves facts.** Change wording and emphasis, never substance.
- **Keyword alignment, not stuffing.** Terms appear because the candidate earned them,
  in natural sentences — not in a hidden or padded keyword dump.
- **Canonical values stay canonical.** Respect flagged/resolved values in the superset
  (e.g. the exact CGPA); don't reintroduce alternates.
- **Ask before collapsing roles.** When a company has 2+ roles, never decide the
  display silently — confirm `senior-only` / `separate` / `combined` with the user
  (step 5).
- **When in doubt, leave it out.** If unsure whether a claim is supported, omit it and
  flag it as a gap. An honest gap always beats a fabricated match.
- **Keywords need a visible backer.** Don't keep a Skills-list term whose only evidence
  lives in a company/project you excluded from the resume. Pull a short, honestly
  rephrased line forward (the compact-entry pattern, step 3) or drop the keyword —
  never both keep the keyword and cut its only proof.
- **Never label a resume entry as an aside.** A pulled-forward compact entry is a
  normal `work[]` item with the real company name in `name` — don't prefix it with
  editorial text like "Additional Experience:"; that field is what ATS parsers read
  as the employer name, and decorating it breaks the parse.

## Files in this skill

This skill directory (`.claude/skills/jd-tailored-resume/`) contains:

- `SKILL.md` — this workflow.
- `references/tailoring-guide.md` — how to read a JD, frame by role family, and rephrase
  honestly, with examples. Read it when you need the detail behind steps 1–6.
- `scripts/check_keywords.py` — the keyword-coverage verifier used in step 8.
- `evals/evals.json` — sample test prompts for the skill.

The generator it drives lives in the **surrounding repo** (`resume-system/`, the repo
root three levels up): `dist/` (compiled CLI), `src/` (TypeScript source), `schema/`
(content + theme JSON Schemas), `themes/` (theme presets), and `data/` (the candidate's
superset ground-truth JSON). See the repo's `README.md` for details on the generator.
