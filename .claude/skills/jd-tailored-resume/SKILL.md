---
name: jd-tailored-resume
description: >-
  Reverse-engineer a job description into a tailored, ATS-optimized resume. Given a
  JD (a text file, pasted text, or a link the user provides), extract the role's
  keywords and priorities, then SELECT, REPHRASE, and REORDER content from a
  candidate's superset "ground-truth" resume JSON to produce a new tailored JSON,
  render it to DOCX + PDF via the bundled CLI, verify the JD's key terms are
  consistently present in the resume, and also write a matching plain-text cover
  letter plus short Gmail and LinkedIn outreach messages (with literal
  {{outreachEmployeeName}}/{{jobTitle}}/{{companyName}}/{{jobLink}} placeholders for a
  downstream mail-merge step). Use this skill whenever the user wants to tailor,
  customize, target, or generate a resume/CV for a specific job, role, or company, or
  mentions a job description, JD, job posting, or "make my resume match this job" —
  even if they don't say the word "resume." Produces one output-file set per JD,
  named after the role/company, in a dedicated output folder.
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
writes the tailored JSON; 7 renders; 8 verifies; 9 writes the cover letter; 10 writes
the Gmail/LinkedIn outreach messages; 11 reports.

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
the JD (e.g. the "golang" or "ai" variant), and set it as the active summary — but
rewrite it to the **Relevance + Brilliance formula** (see below and
`references/tailoring-guide.md` §"Framing by role family"), don't just copy a variant
verbatim. Decide which roles/bullets/skills to foreground: backend/distributed roles
lead with databases, event-driven systems, production fixes; AI/agentic roles lead with
MCP, multi-agent, LLM tooling.

**Summary formula.** Two sentences, ≤3–4 lines total:
> Accomplished `{JD job title}` with `{X years}` of experience and expertise in
> `{3–4 of the top skills from the JD}`. Achieved `{biggest, quantified, relevant
> achievement}` for `{named company}`.

The first sentence is **Relevance** (echo the JD's own title + its top skills); the
second is **Brilliance** (a specific, numbers-backed win at a *named* company — never a
vague claim). Always name the company; always quantify.

**Fixed section order.** Use exactly this `sectionOrder`, no trailing sidebars:
```
["summary", "skills", "work", "projects", "education"]
```
Education is **always last**. Projects sit immediately after Work (they're part of the
experience story, not a trailing appendix). There is **no** standalone `openSource`
section — fold open-source into the title line, the summary's Brilliance clause, and
the top Work bullets (step 3). Drop `projects` too if the candidate has none worth
showing for this JD; never place any section after `education`.

**Critical — omit unused sections' data keys entirely, don't just leave them off
`sectionOrder`.** The renderer auto-appends any *populated* canonical section that isn't
in `sectionOrder` (it lands after Education and breaks "Education last"). So the tailored
JSON must simply **not contain** these keys: `about`, `preferences`, `openSource`,
`certifications`, `languages`, `recommendations`, `companyContext`. Listing only the 5
sections in `sectionOrder` is not enough on its own.

### 3. Select content from the superset

For each section, choose the subset that matches the JD:

- **Skills**: keep groups/keywords the JD cares about; you may drop groups irrelevant
  to this role. Preserve the candidate's real items — don't add unlisted tools.
- **Work highlights**: from each company's full bullet list in the superset, pick the
  handful most relevant to the JD. A one-page resume typically shows 4–6 bullets for
  the main role, and only **1–2 business-impact bullets for older/prior roles** — trim
  them hard, they're supporting context, not the main story.
- **Open-source is folded in, not a section.** Open-source contribution is the
  candidate's strongest "Brilliance" signal, and it's genuinely her employer's work
  (the four products are Turbot's OSS). Surface it in three places, not a trailing
  section: (a) the title line (`basics.label`) — e.g. "9,300★ open-source contributor";
  (b) the summary's Brilliance clause — a quantified OSS + named-company achievement;
  (c) the **top 1–2 Work highlights** under that employer (the shipped OSS wins). Do
  **not** emit an `openSource` key. The GitHub profile link already lives in
  `basics.profiles`, so nothing verifiable is lost.
- **Projects**: keep as a section (after Work, before Education) when they reinforce the
  JD; otherwise omit. **Education**: keep, always last. Omit the ground-truth-only
  sections entirely (see step 2's omit rule): preferences, companyContext,
  recommendations, languages, beginner certifications, about.
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

**Adjacent-skill bridging (for a gap with a genuine in-domain equivalent).** If the JD
asks for a specific tool the candidate lacks, but the candidate genuinely has a *close
equivalent in the same domain*, surface the equivalent prominently — as a Skills entry
and, better, in a Work/Projects bullet — so a reviewer sees domain competence, even
though it's not a keyword match:
- JD wants **RabbitMQ** → candidate has **Kafka** → foreground Kafka (messaging /
  event-driven / DLQs). JD wants **GCP Pub/Sub** → same messaging domain.
- JD wants **Pinecone** → candidate has **AWS S3 vector storage / pgvector** → surface
  the real vector-search work.
- JD wants **Jenkins** → candidate has **GitHub Actions** → surface the real CI/CD work.

Strict rules so this stays honest, not stuffing:
1. **Never write the JD's tool name** (don't put "RabbitMQ" anywhere) and never imply
   experience with it. You surface the tool the candidate *actually* used.
2. Only bridge within the **same category** (message queue↔message queue, vector
   store↔vector store, CI↔CI) — never across unrelated domains.
3. It's optional to add a short parenthetical signalling transferability in a bullet
   (e.g. "…Kafka-based event pipeline with consumer groups and DLQs…") — but the
   claim is always about the real tool.
4. In the report (step 11), list the JD's exact term as an **honest gap**, noting you
   covered the domain with the adjacent tool. It is still a gap for that keyword.

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
- **Set `basics.label` (the title line) — pack it.** Format:
  `{target title} · {top employer or OSS scale} · {2–3 superpower skills} · {years}`,
  e.g. `AI / Backend Engineer · 9,300★ open-source contributor · Python · RAG · MCP ·
  3.5+ Years`. This line is prime real estate — surface the open-source cred here.
- **Write the summary to the Relevance + Brilliance formula** (step 2), into the active
  summary variant. Set `basics.activeSummary` to that variant's key. Name a company and
  quantify the achievement; fold the open-source scale into the Brilliance clause.
- **Set `sectionOrder` to exactly `["summary","skills","work","projects","education"]`**
  (drop `projects` if unused). Education last. **Do not emit** `openSource`, `about`,
  `preferences`, `certifications`, `languages`, `recommendations`, or `companyContext`
  keys — omitting them from `sectionOrder` is not enough, the data key must be absent
  (step 2's omit rule).
- **Fold open-source into the top 1–2 Work highlights** under the relevant employer
  (e.g. "Core contributor across four open-source products — 120+ merged PRs, 9,300+
  GitHub stars…"), since there's no standalone section.
- Set `roleDisplay` on each multi-role company per the user's answer in step 5.
- Include or drop each company's `domainNote` per the user's answer in step 5 (all-or-none).
- Include a realistic contact block from the superset's `basics` (keep the GitHub
  profile link — it backs the folded-in open-source claim).
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

### 9. Write the cover letter

Produce a one-page, plain-text cover letter for this JD, reusing the same JD-keyword
map (step 4) and content selections (steps 2–6) — same honesty rules apply: only
reference experience that's actually in the tailored resume, name at most one honest
gap if it's material, and never fabricate.

Shape: a contact block pulled from `basics` (name, email, phone, links — no date line,
since the candidate doesn't control when it's sent) → `Dear Hiring Manager,` → 3–4 body
paragraphs mapping the JD's top priorities to specific, real evidence (bullet-level
detail — "designed and built a Go/Gin microservice, containerized it, deployed to AWS
EC2" — not just a list of skill names) → optionally one sentence naming a genuine gap,
framed as a fast-learning track record rather than an apology → a closing
call-to-action → sign-off with the candidate's name.

**Lead with the same brilliance hook as the resume.** The opening paragraph should
carry the same Relevance + Brilliance signal the resume's title/summary lead with (the
open-source scale + one named, quantified company achievement) — one consistent story
across resume, cover letter, and the outreach messages below.

Write it to `<output_folder>/<FileName>_CoverLetter.txt` (same `<FileName>` as the
resume triple, e.g. `Chatterjee_Stripe_Backend_Engineer_CoverLetter.txt`). See
`references/tailoring-guide.md` (§"Cover letter & outreach message guidelines") for a
full worked example.

### 10. Write outreach messages (Gmail & LinkedIn)

Produce two short, plain-text cold-outreach/referral-style messages addressed to an
employee at the target company (a recruiter, hiring manager, or any employee — not
necessarily HR) — not a repeat of the cover letter. Tone: "I applied for this role, saw
you're at the company, would love a referral or a quick chat," not a formal
application.

**Both messages must contain these 4 tokens verbatim** wherever the recipient's name,
the role, the company, or the job link would go — a downstream mail-merge step
substitutes them later, so **never invent a real name or fill these in yourself**:
`{{outreachEmployeeName}}`, `{{jobTitle}}`, `{{companyName}}`, `{{jobLink}}`.

- **Gmail** (`<FileName>_Gmail.txt`): starts with a `Subject:` line, 3–5 sentences,
  may reference 1–2 of the strongest JD-matched keywords/evidence for credibility.
- **LinkedIn** (`<FileName>_LinkedIn.txt`): no subject line, 2–3 sentences, kept under
  ~500 characters — LinkedIn messages are read on mobile and are effectively capped,
  so stay tight regardless of the exact platform limit.

Both close with just the candidate's name (no phone/email — the channel itself already
carries that context); reference only the sharpest 1–2 matches, not the full
cover-letter pitch. Same honesty rules as everywhere else — no new claims beyond what's
in the tailored resume. See `references/tailoring-guide.md` (§"Cover letter & outreach
message guidelines") for templates.

**Never hard-wrap a paragraph onto multiple lines.** Each paragraph must be written as
one single unbroken line of text (a blank line separates paragraphs, e.g. before
`Thanks so much,`). Gmail and LinkedIn both render a mid-paragraph newline as a hard
line break, not a reflowable wrap, so a paragraph written across several source lines
displays broken/choppy to the recipient. This matters more than usual here because a
downstream mail-merge step sends these verbatim — there's no editor pass to fix it
before it goes out.

### 11. Report to the user

Summarize concisely:
- The file(s) produced and where — resume (docx/pdf/json), cover letter, and the
  Gmail + LinkedIn outreach messages.
- Which JD priorities you emphasized and the framing/summary you chose.
- Keyword coverage (e.g. "18/20 JD terms present").
- **Honest gaps**: JD terms the candidate doesn't demonstrate, listed plainly, with a
  one-line note that these were intentionally not fabricated. For any gap you covered
  with an **adjacent skill** (step 4 — e.g. JD wanted RabbitMQ, you surfaced Kafka),
  say so explicitly: name the JD term as a gap and the in-domain equivalent you led with.
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
