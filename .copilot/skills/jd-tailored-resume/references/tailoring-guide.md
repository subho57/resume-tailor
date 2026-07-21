# Tailoring Guide

Depth behind the main workflow. Read this when you need the detail behind reading a JD,
choosing a framing, and rephrasing honestly.

## Contents
1. Reading a JD
2. Framing by role family
3. Selecting content
4. Rephrasing examples (honest keyword alignment)
5. Common pitfalls
6. Cover letter & outreach message guidelines

---

## 1. Reading a JD

A JD is a screening spec. Reverse-engineer it into a weighted keyword list plus a sense
of what the team values.

**Extract in this order:**

1. **Title & seniority.** Sets the bar for scope/leadership language. "Senior"/"Lead"
   → emphasize ownership, mentoring, cross-team work (only if the candidate has it).
2. **The "Requirements"/"Must have" block.** These are hard filters. Every term here
   that the candidate genuinely has MUST appear in the resume, in the JD's wording.
3. **The "Nice to have"/"Bonus" block.** Softer. Cover the ones the candidate has;
   ignore the rest without guilt.
4. **Repetition & ordering.** A term repeated across summary + responsibilities +
   requirements is a top priority. Terms listed first in a list usually matter most.
5. **Domain signals.** "regulated", "compliance", "PCI" → security/compliance framing.
   "low latency", "scale", "distributed" → systems framing. "LLM", "agents", "RAG" →
   AI framing.
6. **Exact phrasing for ATS.** Record literal forms: "CI/CD" (not "continuous
   integration"), "REST APIs", "event-driven", "Node.js" (not "Node"). ATS matching is
   literal and often exact-token; echo the JD where truthful.

**Weighting heuristic:** must-have + repeated + title-relevant = highest priority;
cover these first and prominently. Nice-to-have + mentioned once = cover if easy.

---

## 2. Framing by role family

The superset typically carries multiple summary variants and a superset of bullets that
can lean several ways. Pick the lean that matches the JD.

### The summary formula (Relevance + Brilliance)

Don't paste a superset summary variant verbatim — reshape the chosen variant into two
sentences, ≤3–4 lines:

> Accomplished **{JD job title}** with **{X years}** of experience and expertise in
> **{3–4 of the top skills from the JD}**. Achieved **{biggest, quantified, relevant
> achievement}** for **{named company}**.

- Sentence 1 = **Relevance**: echo the JD's exact title and its top 3–4 skills, so a
  recruiter (and the ATS) sees the match in the first line.
- Sentence 2 = **Brilliance**: one specific, numbers-backed win at a *named* company.
  This is where the open-source scale goes (it's the strongest single signal).

**Worked example** (Python/AI JD): *"Accomplished AI / Backend Engineer with 3.5+ years
building production AI systems in Python — RAG pipelines, multi-agent LLM workflows, and
an MCP server. Core contributor to four open-source products at Turbot (120+ merged PRs,
9,300+ GitHub stars), shipping a Steampipe MCP server giving LLM agents real-time access
to enterprise data."* — JD title + 3 JD skills, then a named-company, quantified,
open-source-backed brilliance clause.

Use the same brilliance hook to open the cover letter and the Gmail/LinkedIn messages —
one consistent story across all four artifacts.

### Per-family leans

**Golang / backend / distributed systems**
- Summary: reshape the "golang" or "impact-led" variant to the formula above.
- Lead work bullets with: language (Go), APIs (REST/gRPC), event-driven pipelines
  (Kafka/DLQ), databases (PostgreSQL/DuckDB/Redis), performance wins, production
  incident debugging, release engineering.
- Pull AI/agentic bullets DOWN or drop them unless the JD mentions AI.

**Node.js / backend**
- Summary: the "golang/node.js" variant, Node-forward.
- Foreground the Node.js/Lambda backend work (Guardrails, AWS SDK migration, Express),
  event-driven architecture, and databases. Keep Go present but secondary.

**Python / AI automation / agentic**
- Summary: the "python-ai-automation" or "ai-integrated-backend" variant.
- Lead with MCP server, multi-agent workflow (OpenAI Agents SDK), RAG agent, Pydantic
  AI, LLM tooling, Python automation. Cloud/compliance becomes supporting context.

**Platform / DevOps / infra**
- Summary: the "platform-engineer" or "devops-infra" variant.
- Lead with CI/CD (GitHub Actions), Docker/Kubernetes, Terraform/OpenTofu, release
  pipelines, multi-distro testing. Represent Kubernetes exactly as the ground truth
  states it (e.g. "working knowledge").

If the superset declares role preferences (e.g. Golang > Node.js > Python/AI), and the
JD is ambiguous or spans several, bias toward the higher-preference framing.

---

## 3. Selecting content

- **Length:** default to one page for a tailored resume. That's ~4–6 bullets for the
  most recent/relevant role, 2–3 for prior roles, a tight skills block, and 1–2
  projects. The `--one-pager` flag will shrink within ATS-safe floors and
  warn if it can't — if it warns, cut bullets, don't shrink into 8pt.
- **Skills:** reorder groups so JD-relevant ones come first; you may drop groups the JD
  doesn't touch. Never add tools the candidate doesn't list in the superset.
- **Omit ground-truth-only sections** in a tailored resume: `preferences`,
  `companyContext`, the full `recommendations` list, and beginner-MOOC certifications
  (unless the JD specifically values a cert the candidate holds).
- **Older/tiny roles:** keep or drop based on relevance and space. A senior backend JD
  rarely needs a 2021 web-dev internship; include it only if it fills a gap or space
  allows — **except** when it's the only backing for a skill keyword you're keeping
  (see below), in which case pull a one-line mention forward instead of dropping it
  silently.
- **Don't orphan a keyword.** If you keep "Elasticsearch" in Skills because a 2021
  internship used it, but you cut that internship's work-experience block entirely,
  the keyword now has zero visible backing in the resume — a reviewer sees a claim
  with nothing behind it. Either add a compact, ordinary `work[]` entry for that
  company (real name, real year, the one relevant fact — no full bullet list, no
  domain note) or drop the keyword from Skills. Don't do neither, and don't label it
  as an aside (e.g. "Additional Experience: X") — the company-name field is what ATS
  parsers read as the employer, and decorating it with editorial text breaks the
  parse.
- **Track the confirmed-keyword list as you go.** Every term you keep because it's
  genuinely backed (not a gap) is a candidate for `--keywords` at render time (step 7)
  — it bolds those exact terms wherever they land in Summary/Work/Projects. Build this
  list alongside the selection work in this section rather than trying to reconstruct
  it afterward from the finished JSON.

### Section structure (fixed order)

A tailored resume uses a fixed 5-section skeleton, in this order, **Education always
last**:

```
Summary → Skills → Work Experience → Projects → Education
```

- **Projects are part of the experience story**, not a trailing appendix — they render
  right after Work, before Education. Drop the Projects section entirely if the
  candidate has nothing worth showing for this JD (never place it after Education).
- **No standalone open-source section.** Open-source is the candidate's strongest
  brilliance signal, so it goes up top where recruiters read, not at the bottom:
  - *Before:* a trailing "Open-Source Contributions" section under Education.
  - *After:* the scale line moves into `basics.label` (e.g. "9,300★ open-source
    contributor"), the summary's Brilliance clause ("…120+ merged PRs across four
    open-source products at Turbot…"), and the top 1–2 Work highlights (the shipped
    OSS wins). The GitHub link in `basics.profiles` keeps it verifiable.
- **Omit the key, don't just unlist it.** The renderer auto-appends any *populated*
  canonical section that isn't in `sectionOrder`, so it lands after Education and breaks
  the "Education last" rule. The tailored JSON must simply **not contain** these keys:
  `about`, `preferences`, `openSource`, `certifications`, `languages`,
  `recommendations`, `companyContext`. Setting `sectionOrder` to the 5 sections is
  necessary but not sufficient on its own.
- **Older roles → 1–2 business-impact bullets only.** The current/most-relevant role
  carries 4–6; everything prior is trimmed hard to supporting context.

---

## 4. Rephrasing examples (honest keyword alignment)

The move is: **same fact, JD's vocabulary.** Below, the superset bullet is on top and a
JD-aligned rephrase is below it. Note that numbers, employers, and substance never
change — only wording and emphasis.

**JD term: "event-driven architecture"**
- Superset: "Migrated 35+ Azure cloud-governance modules from polling to push-based
  eventing via Azure Event Grid, cutting resource-discovery latency 70–90%."
- Aligned: "Re-architected 35+ Azure cloud-governance modules to an **event-driven**
  model using Azure Event Grid, cutting resource-discovery latency 70–90%."

**JD term: "RESTful APIs" + "microservices"**
- Superset: "Designed and developed an internal REST API microservice in Go using Gin…"
- Aligned: "Built an internal **RESTful API microservice** in Go (Gin) powering the
  Guardrails backend…" (already matches; just ensure the exact token "RESTful" appears
  if the JD uses it and the work is genuinely RESTful).

**JD term: "high-throughput data pipelines"**
- Superset: "Engineered core features for Tailpipe… lifting log-processing throughput
  30% to 1,000+ logs per second…"
- Aligned: "Built **high-throughput** log-processing features (1,000+ logs/sec, +30%
  throughput) in Tailpipe on DuckDB + Parquet."

**JD term: "message queues" / "Kafka"**
- Superset: "Built a Kafka-based, fire-and-forget event-driven pipeline… added a
  dead-letter queue (DLQ)…"
- Aligned: keep "Kafka" and "dead-letter queue (DLQ)" verbatim — they already match; do
  not paraphrase a matching keyword into something the ATS won't catch.

**Honest-gap example (do NOT do this):**
- JD term: "Kubernetes (deep production experience)."
- Superset: "Kubernetes (working knowledge; collaborate with platform teams)."
- WRONG: "Operated production Kubernetes clusters at scale." ← fabrication.
- RIGHT: keep it as working knowledge, and if the JD leans heavily on deep k8s, note in
  the report that this is a partial match.

**Rule of thumb:** if a JD keyword already appears verbatim in a relevant superset
bullet, preserve it exactly. If the fact is present but worded differently, rephrase to
the JD's term. If the fact isn't there, leave the keyword out.

**Adjacent-skill bridging (the middle path between "match" and "gap"):**
- JD term: "RabbitMQ" (message broker). Superset has no RabbitMQ — but has Kafka.
- WRONG: write "RabbitMQ" or "message brokers like RabbitMQ/Kafka" ← implies RabbitMQ.
- RIGHT: foreground the real Kafka work in Skills and in a bullet ("Kafka-based
  event-driven pipeline with consumer groups and a dead-letter queue"), so the reviewer
  sees clear message-queue/event-driven competence. Report RabbitMQ as an honest gap
  covered by the adjacent tool.
- Same pattern: Pinecone→(pgvector / S3 vector storage), Jenkins→(GitHub Actions),
  Terraform→(OpenTofu), GCP Pub/Sub→(Kafka / AWS SNS-SQS). Only ever bridge *within the
  same category*, and the claim is always about the tool the candidate really used.

---

## 5. Common pitfalls

- **Paraphrasing away a matching keyword.** If the JD says "gRPC" and the bullet says
  "gRPC", don't "improve" it to "RPC services" — you'd lose the ATS match.
- **Keyword stuffing / skills soup.** Don't dump every JD term into the skills list.
  Only include tools the candidate genuinely uses; let bullets carry the rest naturally.
- **Inflating seniority or scope** to match a senior title. Represent the real level.
- **Changing canonical values.** Respect flagged/resolved values in the superset (e.g.
  the exact CGPA). Don't reintroduce alternates that the ground truth marks as wrong.
- **Over-length.** Two pages of tailored content for a role that wants one page reads as
  unfocused. Cut to the JD.
- **Ignoring the verifier's real hits.** If `check_keywords.py` flags a term as missing
  and the candidate genuinely has it, that's a real miss to fix — surface it. Only the
  unsupported terms should stay missing.
- **Orphaned keywords.** `check_keywords.py` only checks whether a term's text appears
  *anywhere* in the resume — including a bare Skills-list entry with zero supporting
  bullet. It will report a keyword as "present" even if you cut the only company/project
  that demonstrates it. That's not a pass; check it yourself (step 4): every kept
  keyword needs a visible bullet behind it — a normal (if compact) work entry, not
  just a verifier green-light.

---

## 6. Cover letter & outreach message guidelines

Detail behind SKILL.md steps 9–10. Same source material as the resume (the JD-keyword
map from step 4, the content selections from steps 2–6) and the same honesty rules —
these are just shorter, differently-shaped presentations of the same evidence, never a
place to introduce a new claim that isn't already in the tailored resume.

### Template-variable contract (Gmail & LinkedIn only)

The Gmail and LinkedIn messages are cold-outreach/referral asks to an **employee at the
target company** — a recruiter, hiring manager, or any employee, not necessarily HR.
Because the skill never knows who that person actually is, four tokens stand in for
values a downstream mail-merge step fills in later:

| Token | Represents |
|---|---|
| `{{outreachEmployeeName}}` | The recipient's name |
| `{{jobTitle}}` | The role title (JD's own title) |
| `{{companyName}}` | The hiring company |
| `{{jobLink}}` | A link to the job posting |

**Write these exactly as shown, verbatim, every time** — never guess a real name,
never resolve them to actual values, never drop or rename them. They belong in the
Gmail/LinkedIn messages only; the cover letter and resume don't use them (the cover
letter addresses "Dear Hiring Manager," instead, since it's a formal document, not a
templated mail-merge send).

### Cover letter template

```
<Candidate name>
<Location>
<email> | <phone>
<LinkedIn> | <GitHub/portfolio>

<Company> — <Team, if the JD names one>
Re: <Job title> (<req ID, if the JD has one>)

Dear Hiring Manager,

<Paragraph 1: who you are + years of experience + the JD's own framing (seniority,
domain, environment) echoed back honestly.>

<Paragraph 2-3: 2-4 concrete, bullet-level pieces of evidence mapped to the JD's top
priorities — real project/company names, real numbers, in the JD's vocabulary.>

<Optional paragraph: one honest gap, framed as a fast-learning track record, not an
apology — see the worked example below.>

<Closing paragraph: call to action, thanks.>

Sincerely,
<Candidate name>
```

**Worked example** (from this repo's `output/Chatterjee_Fox_Video_Player_Engineer_CoverLetter.txt`,
written for a Video Player Engineer JD at Fox that wanted Go/React/AWS/containers but
also video-streaming-specific skills the candidate doesn't have):

```
Priyanka Chatterjee
Kolkata, West Bengal, India (open to remote)
priyankachatterjee9075@gmail.com | +91 8617262536
linkedin.com/in/priyanka-9075 | github.com/Priyanka-Chatterjee-2000

Fox Corporation — Digital Video Platform Team
Re: Video Player Engineer (R50033063)

Dear Hiring Manager,

I'm writing to apply for the Video Player Engineer role on the Fox Digital Video
Platform team. I bring 3.5+ years of backend and frontend engineering experience
in Go and React.js, built largely in fast-moving, ambiguous environments similar
to the one your job posting describes.

At Turbot HQ, I designed and built an internal REST API microservice in Go (Gin
framework), containerized it with Docker, deployed it to AWS EC2, and wired it
as a gRPC client for several other internal microservices — direct, hands-on
experience with the containers/microservices architecture your posting asks
for. [...]

I'll be candid about one gap: I haven't yet worked directly with video
streaming protocols (HLS/DASH) or AWS Media Services (MediaConvert/
MediaLive/MediaPackage). What I can offer instead is a fast learning track
record — open-source work across four Go-based platform products (120+ merged
pull requests, 9,300+ GitHub stars) where I regularly picked up new domains
quickly — and a strong foundation in the Go, React, AWS, and distributed-systems
fundamentals the role is built on.

I'd welcome the chance to talk about how I could contribute to the team
delivering video for Fox's biggest live events. Thank you for your time and
consideration.

Sincerely,
Priyanka Chatterjee
```

Note the shape: contact block, JD-specific "Re:" line, evidence paragraphs in the JD's
own vocabulary, exactly one honest gap named plainly and reframed positively, a short
closing. No template variables anywhere — this is a real letter with real facts, not a
mail-merge document.

### Gmail message template

**Each paragraph is one unbroken source line** — a blank line separates paragraphs,
but never break a paragraph across lines the way this guide wraps prose for
readability. Gmail/LinkedIn render a mid-paragraph newline as a hard break, not a
reflow, and these get sent verbatim by a downstream mail-merge step with no editing
pass — a wrapped paragraph reaches the recipient looking broken.

```
Subject: <Job title> at <Company> — quick intro

Hi {{outreachEmployeeName}},

I recently applied for the {{jobTitle}} role at {{companyName}} ({{jobLink}}) and wanted to reach out directly. <1-2 sentences: sharpest JD-matched evidence, e.g. "I've spent the last 3+ years building Go microservices and AWS-deployed backend services, including a production MCP server for LLM access to enterprise data."> I'd love to connect and hear more about the team if you have a few minutes.

Thanks so much,
<Candidate first name>
```

### LinkedIn message template

Shorter — no subject line, aim for 2-3 sentences and under ~500 characters. Same
single-line-per-paragraph rule applies:

```
Hi {{outreachEmployeeName}}, I just applied for the {{jobTitle}} role at {{companyName}} ({{jobLink}}) and wanted to reach out directly — my background is a close match (<1 sentence, sharpest single piece of evidence>). Would love to connect or hear about the team if you have a moment.

<Candidate first name>
```

### Rules specific to these two messages

- **Honesty carries over.** Only reference matches that are genuinely in the tailored
  resume — these are shorter, not a place to reach for something the resume itself
  left out.
- **Don't repeat the whole cover letter.** Pick the 1-2 single sharpest matches, not a
  survey of everything.
- **No invented recipient details.** Never write a guessed name, title, or company
  detail into the `{{...}}` slots — leave them as literal placeholder text.
- **Sign-off is name only.** Phone/email/links are redundant on a channel that already
  carries that context (an email header, a LinkedIn profile) — don't pad the message
  with a repeated contact block.
