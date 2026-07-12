# Tailoring Guide

Depth behind the main workflow. Read this when you need the detail behind reading a JD,
choosing a framing, and rephrasing honestly.

## Contents
1. Reading a JD
2. Framing by role family
3. Selecting content
4. Rephrasing examples (honest keyword alignment)
5. Common pitfalls

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

**Golang / backend / distributed systems**
- Summary: the "golang" or "impact-led" variant.
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
