# Research Guide

Supporting detail for `SKILL.md` steps 3-6. Read this when you need the concrete
search patterns or want to see the reasoning behind a reconciliation, not just the
rule.

## Researching companies

Run one search per distinct employer/organization named anywhere in the raw
material (resumes, LinkedIn export, notes) — including small companies and
internships, not just the most recent or most prestigious one.

**Search patterns that work:**
- `"<company name>" <city/country from the raw material>` — anchors a generic name
  to the right entity when there are multiple companies with similar names.
- `"<company name>" acquired OR renamed OR "formerly known as"` — catches the case
  where a company the candidate worked at years ago no longer exists under that
  name, which changes how you'd phrase `domainNote`.
- `site:linkedin.com/company "<company name>"` — often the fastest way to get an
  authoritative one-line description of what a company does.

**When a company can't be found:** small, generic-sounding, or old company names
often return nothing usable, especially internships or short stints. This is a
normal outcome, not a search failure. Write it into `companyContext` plainly:
name is generic/small, no independent public record found, treat domain details as
candidate-reported. Do not pad the search with a company description drawn from
what the candidate's bullets *imply* the company does and present it as verified —
keep "verified via search" and "inferred from the candidate's own description"
visibly distinct in the text.

## Researching the candidate's own public footprint

Even when the candidate hands you a LinkedIn export or an old resume, run an
independent identity search — the supplied file is a snapshot that may already be
stale (a promotion since it was exported, a job change, a new project).

**Search patterns that work:**
- `"<full name>" <most recent or most distinctive employer>` — the employer anchors
  the search to the right person when the name is common.
- `"<full name>" github` / `"<full name>" <project name>` — for any open-source
  project, tool, or publication the raw material mentions.
- `"<full name>" <field> <city>` — a fallback when employer-anchored search is
  noisy or the name is very common.

**What to do with what you find:**
- A real profile URL you can point to → add it to `basics.profiles[]`. Never
  construct a URL by guessing a slug pattern (e.g. assuming
  `linkedin.com/in/firstname-lastname` resolves) — if you didn't land on the page
  via search or the candidate didn't give you the link directly, it doesn't go in.
- A discrepancy with the supplied files (different current title, different star
  count on a repo, a role the supplied resume doesn't mention) → this is exactly
  what step 5's reconciliation handles. Don't quietly prefer the fresher-looking
  source without saying so in a note.
- Nothing found at all → normal for private individuals or in a test/practice run.
  State it plainly in the final report; don't leave the attempt unmentioned.

## Reconciling conflicts — worked example

Two sources disagree on a job's date range:

- Old resume (self-written, 2023): "Innovate Labs — Jun 2020 – Dec 2021"
- LinkedIn export: "Innovate Labs — Jun 2020 – May 2021", immediately followed by
  the next job starting Jun 2021 with no gap or overlap.

The LinkedIn version is internally consistent with the rest of the candidate's
timeline (no overlap with the next job); the old resume's Dec 2021 end date would
create a two-month overlap with a job that starts Jun 2021. That inconsistency is
itself evidence — prefer the version that doesn't produce an impossible timeline,
and say so:

```json
{
  "text": "Tenure at Innovate Labs ran June 2020 – May 2021.",
  "flagged": true,
  "note": "Reconciliation: the 2023 resume lists Jun 2020 – Dec 2021. The LinkedIn export lists Jun 2020 – May 2021, immediately followed by the next job starting Jun 2021 with no gap or overlap. Because the resume's Dec 2021 end date would overlap the next job's start, LinkedIn's May 2021 end date is carried forward as authoritative and Dec 2021 is treated as the flagged alternate."
}
```

Note the shape: **primary text states the resolved fact plainly** (a reader who
never opens the note still gets a coherent date range); **the note carries the full
reasoning and the discarded alternate** for whoever needs to correct it later.

## The fabricated-date trap

This is the single most common way this task goes wrong, because the instinct to
"fill in the field" is strong even when nothing in the source material licenses a
specific value.

**The trap:** raw notes say a certification was earned "last year" with no anchor
date given anywhere. A first draft looks like this:

```json
{
  "title": "AWS Certified Solutions Architect – Associate",
  "issuer": "Amazon Web Services (AWS)",
  "date": "2025 (approximate)"
}
```

This *looks* careful — it says "(approximate)" right there — but it still commits a
specific year, 2025, that appears in **no source at all**. It was picked because it
seemed like a reasonable guess, not because any evidence supports it. A reader (or
a downstream render) sees a year in the `date` field and has no way to tell it's a
guess rather than a fact, since the schema has no per-item flagged field for
certifications.

**The fix:** don't write a value more precise than your evidence. Either keep the
field as vague as the source actually is, or leave it blank, and put the honest gap
in the shared `certificationsNote`:

```json
{
  "title": "AWS Certified Solutions Architect – Associate",
  "issuer": "Amazon Web Services (AWS)",
  "date": ""
}
```
```json
"certificationsNote": "Exact award date unknown — candidate's notes say only 'last year' with no reference point given. Confirm with the candidate before rendering a dated resume.",
"certificationsNoteFlagged": true
```

The difference isn't cosmetic: "2025 (approximate)" is a specific claim dressed up
as a caveat; an empty `date` field with an honest note is a gap that stays visibly
a gap. Apply the same test anywhere else a value tempts you to round up: a star
count, a team size, a percentage, a year. If you can't point to the source that
gave you that exact figure, don't write that exact figure.
