---
name: master-resume-builder
description: >-
  Use when a candidate hands over a pile of raw personal-history material — old
  resumes in any format, a LinkedIn/GitHub export, freeform notes, chat transcripts,
  performance reviews — and wants it consolidated into one comprehensive ground-truth
  resume JSON. Also use when asked to build, create, update, or merge a "master
  resume", "superset resume", or ground-truth resume.json from scratch or from
  multiple existing documents, or to research a candidate's past employers and public
  profiles (LinkedIn, GitHub, personal site) to fill in or verify resume data.
---

# Master Resume Builder

## Overview

Turn a scattered pile of raw material into **one comprehensive superset resume
JSON** — the ground-truth `data/*.resume.json` document that the
`jd-tailored-resume` skill later trims and rephrases per job. This is a
synthesis-and-verification job, not a writing job: you extract every real fact from
what the candidate gave you, use web search to verify companies and discover the
candidate's own public footprint, reconcile disagreements between sources honestly,
and never invent a fact to fill a gap.

**The core principle is the same as the tailoring skill's, applied one step
earlier:** every fact in the output must trace back to a supplied file or a web
search result. If two sources disagree, keep both and flag it. If nothing pins a
detail down, say so — don't write a plausible-looking value into the field.

## Where this skill lives

This is a **project skill** committed inside the `resume-system` repository at
`.claude/skills/master-resume-builder/`. The schema and CLI it targets are the
surrounding repo itself — **not** a bundled copy. From this skill's directory, the
repo root is three levels up: `../../../`. Paths below are written relative to the
repo root; if running from the repo root (the usual case), drop the `../../../`
prefix.

## Inputs you need

1. **A pile of raw files** — whatever the candidate has: old resumes (`.txt`,
   `.pdf`, `.docx`), a LinkedIn data export or profile PDF, freeform notes or chat
   transcripts, performance reviews, project write-ups. No fixed format — inventory
   whatever's there (step 1). If a file format the Read tool can't parse directly
   shows up (e.g. `.docx`), convert it first: `soffice --headless --convert-to txt:Text <file>`
   (LibreOffice is already a repo prerequisite — see README's "Prerequisites") or
   ask the user to paste the content.
2. **The candidate's full name**, and enough context (current/most recent employer,
   location, field) to distinguish them from unrelated people of the same name in
   web search results.
3. **Where to write the output** — default to `data/<firstname-lastname>.resume.json`
   in the repo root unless the user names a different path.

If no raw files are given at all, stop and ask for at least one — this skill
synthesizes from real material, it does not generate a resume from a name alone.

## Workflow

### 1. Inventory the raw files

Read every file the candidate gave you completely before extracting anything.
Note what each one is (old resume, LinkedIn export, notes, etc.) — you'll need
that provenance in step 5 when sources disagree.

### 2. Extract facts per source, unmerged

For each file, list out every factual claim it makes: employers, titles, date
ranges, bullets/accomplishments, skills, education, certifications, languages,
projects, social/profile links. Keep this per-source — don't merge yet. A fact
that appears in only one source is not automatically suspect; a fact that
conflicts across sources is what step 5 handles.

### 3. Web-research every named company — mandatory, not optional

For **every** employer/organization named in the raw material, run a web search
to confirm what it does and ground the `domainNote`/`companyContext` text in an
actual result — never write a company description from memory alone, even for a
company you're confident you already know (memory can be stale or wrong on
specifics like current name, acquisition, or scope). Two outcomes:

- **Found** → write `domainNote`/`companyContext` from what the search actually
  says, not embellished.
- **Not found** (generic name, tiny company, no public footprint) → say so
  explicitly in `companyContext` (e.g. "name is generic/small; no independent
  public record found — treat as candidate-reported"). An honest "couldn't verify"
  is correct output, not a failure.

See `references/research-guide.md` ("Researching companies") for the search
patterns and how to handle name collisions.

### 4. Web-research the candidate's own public footprint — mandatory, not optional

Search for the candidate's own public presence: `"<name>" <most recent employer>
LinkedIn`, `"<name>" github`, `"<name>" <field> portfolio`, and similarly for any
open-source project or publication mentioned in the raw material. This step exists
even when the candidate already supplied a LinkedIn export — a supplied export can
be stale; a live public search is how you catch that. Two uses for what you find:

- **Populate `basics.profiles[]`** with real URLs you actually found via search or
  that the candidate gave you directly. Never construct a plausible-looking profile
  URL (e.g. guessing a `linkedin.com/in/firstname-lastname` slug) — an unverified
  guess is a fabricated fact like any other.
- **Cross-reference** what's publicly listed against what the supplied files say
  (titles, dates, star counts, project claims). Feed any mismatch into step 5's
  reconciliation, don't silently prefer one.

If a search turns up nothing (common for private individuals, or a fictional/test
name), say so in the report (step 9) rather than leaving it unaddressed.

### 5. Reconcile conflicts across all sources

When two or more sources (supplied files, web search results) disagree on the same
fact — a date range, a title, a metric, a spelling — resolve it using the schema's
own flagging mechanism, never by silently picking one and discarding the other:

- **`work[].highlights[]`**: use the object form `{ text, alt, flagged: true, note }`
  — `text` carries the value you're treating as primary (usually the more specific
  or more recent-looking source), `note` names which sources disagreed and why you
  picked what you picked, `alt` optionally carries the discarded value verbatim.
- **`education[].score`**: use `scoreFlagged: true` + `scoreNote` the same way.
- **`openSource.note`** / **`certificationsNote`** (+ their `...Flagged` siblings):
  use for section-level caveats that don't belong to one specific item.

Prefer the more specific, more internally-consistent source (e.g. a source whose
dates don't overlap with an adjacent job over one that would create an overlap) —
that's weighing evidence, not fabrication. Always say in the note which sources
disagreed and why you chose what you chose. See `references/research-guide.md`
("Reconciling conflicts") for a worked example.

### 6. Never invent a value to fill a gap

The single most important rule in this skill. When a fact is vague or unanchored in
every source — "last year" with no reference date, "a few hundred stars", "around
2019ish" — do **not** write a specific-looking value into the field as though it
were established fact. That value will render on the page indistinguishable from a
verified one.

- If one source is more *specific* than another about the same fact (LinkedIn says
  "~600 stars", notes say "a few hundred"), using the specific source's figure is
  fine — that's picking the best evidence, not inventing.
- If **no** source gives a specific value and search turns up nothing either, keep
  the field as vague as the best source states it (or leave it blank) and put the
  precision gap in the note — do not pick a concrete number/date/name to make the
  field look complete. See `references/research-guide.md` ("The fabricated-date
  trap") for a concrete before/after of this exact mistake.

### 7. Assemble the full schema-conforming JSON

Write the output conforming to `schema/resume.schema.json`. This is a superset
document, not a tailored one — populate every section the raw material supports,
including ones a tailored resume would normally trim:

- `basics.summaries` — write 2-4 named variants for different role framings the
  candidate might target (e.g. `default`, plus one per role family evident in their
  history/preferences). Leave `basics.activeSummary` unset — the ground-truth
  document lists every variant for the tailoring skill to choose from later.
- `work[]` — use `roles[]` + `roleDisplay` for any company with more than one title
  (promotions); keep every role, even ones the candidate says they don't want on a
  tailored resume (that decision belongs to the tailoring step, not here — flag a
  candidate's stated preference in a `note` instead of omitting the fact, per step
  5's pattern).
- `education`, `skills` (deduplicated), `openSource`, `projects`, `certifications`,
  `languages`, `recommendations`, `preferences`, `companyContext` — populate
  whatever the raw material and research support; leave a section empty/absent
  rather than padding it.
- Don't set `theme`/`sectionOrder` beyond schema defaults unless the candidate asks
  for a specific one — this document's job is content completeness, not layout.

### 8. Validate and render

Confirm the JSON is schema-valid and renders (a genuine superset will be
multi-page — that's expected, not a bug):

```bash
bun install && bun run build   # one-time, if dist/ is missing
bun dist/cli.js --content data/<firstname-lastname>.resume.json
```

Fix any validation warnings the CLI prints before reporting completion.

### 9. Report to the user

Summarize concisely:
- The output file path.
- Every raw file used and what it contributed.
- **Every web search you ran and what it was for** (company verification, profile
  discovery) — including searches that came back empty.
- Every conflict you flagged (step 5) with a one-line reason for the resolution.
- Every gap you left honestly unresolved (step 6) rather than guessing.
- Any profile/URL you found and added, and any you looked for but couldn't find.

## Guardrails (do not violate)

- **Never fabricate.** No employer, title, date, metric, or URL that isn't in a
  supplied file or an actual web search result. This is the same ethic
  `jd-tailored-resume` applies when selecting content — applied here one step
  earlier, when the ground truth itself is being written.
- **Every company gets a search attempt.** Skipping a company because it "sounds
  well-known enough" is exactly the failure mode this skill exists to prevent —
  memory drifts; search doesn't.
- **Every candidate gets an identity-search attempt.** Don't rely solely on a
  supplied export; a live search is how you catch staleness and discover profiles
  the candidate didn't think to mention.
- **Conflicts are flagged, never silently resolved.** Use `flagged`/`note`/`alt` —
  picking a source without saying so, or without keeping the alternate, loses
  information the candidate may need to correct later.
- **A vague fact stays vague.** Don't round "last year" into a specific year or
  "a few hundred" into an exact count unless a source actually gives you that
  precision. See step 6.
- **When in doubt, say so — don't guess.** An explicit "couldn't verify" or
  "unknown, ask the candidate" always beats a plausible-looking invented value.

## Files in this skill

This skill directory (`.claude/skills/master-resume-builder/`) contains:

- `SKILL.md` — this workflow.
- `references/research-guide.md` — search patterns for companies and identity
  cross-referencing, the reconciliation worked example, and the fabricated-date
  trap in detail.

The generator it feeds lives in the **surrounding repo** (`resume-system/`, the
repo root three levels up): `schema/resume.schema.json` (the target schema),
`dist/`/`src/` (the CLI that validates and renders the output), and `data/` (where
the finished superset JSON lives alongside other candidates' ground-truth docs).
