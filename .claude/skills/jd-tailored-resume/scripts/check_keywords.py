#!/usr/bin/env python3
"""
Keyword coverage checker for JD-tailored resumes.

Given a job-description text file and the generated resume (the tailored JSON,
or a .txt/.pdf export of the resume), report which JD keywords/skills appear in
the resume and which are missing. This is the verification step: the goal is that
terms the JD emphasizes are consistently present in the resume (only where the
candidate genuinely has that experience).

Usage:
  python check_keywords.py --jd jd.txt --resume tailored.json
  python check_keywords.py --jd jd.txt --resume resume.pdf
  python check_keywords.py --jd jd.txt --resume resume.txt --extra-terms "Kafka,gRPC"

Exit code is always 0 (this is advisory, not a gate). Prints a coverage report.

Notes:
- This uses a transparent, dependency-light heuristic (no ML): it pulls candidate
  terms from the JD (multi-word tech phrases, capitalized tokens, and a curated
  tech vocabulary) and matches them case-insensitively against the resume text,
  accounting for the U+2011 non-breaking hyphen the renderer inserts.
- It is meant to guide the tailoring, not to "keyword-stuff." Never add a term to
  the resume that the candidate cannot back up (see references/tailoring-guide.md).
"""
import argparse
import json
import re
import sys
import subprocess
from pathlib import Path

# A compact, extensible vocabulary of technical terms worth treating as atomic
# keywords when they appear in a JD. Multi-word entries are matched as phrases.
TECH_VOCAB = {
    # languages
    "go", "golang", "python", "typescript", "javascript", "java", "sql", "bash",
    "hcl", "c++", "rust", "kotlin", "ruby", "php", "scala",
    # backend / arch
    "microservices", "event-driven", "distributed systems", "serverless", "rest",
    "restful", "graphql", "grpc", "websockets", "websocket", "api", "apis", "jwt",
    "rbac", "message queue", "message queues", "pub/sub", "webhook", "webhooks",
    # runtimes / frameworks
    "node.js", "nodejs", "express", "express.js", "gin", "bun", "react", "fastapi",
    "flask", "django", "spring", "spring boot",
    # data
    "postgresql", "postgres", "mysql", "mongodb", "redis", "duckdb", "sqlite",
    "elasticsearch", "kafka", "parquet", "dynamodb", "cassandra", "snowflake",
    # cloud
    "aws", "azure", "gcp", "oci", "alicloud", "lambda", "ec2", "s3", "rds",
    "eventbridge", "sns", "sqs", "event grid", "kubernetes", "k8s", "docker",
    "terraform", "opentofu", "helm", "cloudformation",
    # devops / ci
    "ci/cd", "github actions", "gitlab ci", "jenkins", "observability", "datadog",
    "opentelemetry", "otel", "prometheus", "grafana", "logfire",
    # ai / llm
    "llm", "rag", "agentic", "multi-agent", "mcp", "model context protocol",
    "openai", "pydantic ai", "vercel ai sdk", "claude code", "prompt engineering",
    "vector", "embeddings", "fine-tuning",
    # security / compliance
    "cis", "nist", "hipaa", "pci dss", "soc 2", "fedramp", "iam", "siem", "cmdb",
    "compliance", "governance",
    # cs / practices
    "data structures", "algorithms", "system design", "oop", "object-oriented",
    "unit testing", "integration testing", "code review", "tdd", "agile", "scrum",
}

# Multi-word vocab entries need phrase matching; precompute the set.
MULTIWORD = {t for t in TECH_VOCAB if " " in t or "/" in t}

STOPWORDS = {
    "the", "and", "for", "with", "you", "your", "our", "are", "will", "have", "has",
    "this", "that", "from", "who", "what", "when", "how", "all", "any", "can", "not",
    "role", "team", "work", "working", "years", "year", "experience", "strong",
    "ability", "including", "etc", "using", "use", "used", "across", "within",
    "plus", "must", "should", "would", "could", "job", "candidate", "candidates",
    "responsibilities", "requirements", "qualifications", "preferred", "nice",
    # common JD section headers / filler that are not skills
    "about", "overview", "summary", "description", "benefits", "perks", "location",
    "remote", "hybrid", "onsite", "full", "time", "senior", "junior", "lead",
    "staff", "principal", "engineer", "developer", "manager", "about the role",
    "what you", "you will", "we are", "we're looking", "thrive",
}

NBH = "\u2011"  # non-breaking hyphen used by the renderer


def normalize(text: str) -> str:
    return text.replace(NBH, "-").lower()


def extract_resume_text(path: Path) -> str:
    """Get plain text from a tailored JSON, a .txt, or a .pdf."""
    suffix = path.suffix.lower()
    if suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        return json.dumps(data)  # all string values are included; good enough for matching
    if suffix == ".txt":
        return path.read_text(encoding="utf-8")
    if suffix == ".pdf":
        try:
            out = subprocess.run(["pdftotext", "-layout", str(path), "-"],
                                 capture_output=True, text=True, check=True)
            return out.stdout
        except Exception as e:
            print(f"warning: could not run pdftotext on {path}: {e}", file=sys.stderr)
            return ""
    # fallback: read raw
    return path.read_text(encoding="utf-8", errors="ignore")


def extract_jd_keywords(jd: str) -> list:
    """Pull candidate keywords from the JD: vocab hits + multiword phrases +
    capitalized/techy tokens. Returns a de-duplicated, order-preserving list."""
    low = jd.lower()
    found = []
    seen = set()

    def add(term):
        t = term.strip().lower()
        if t and t not in seen:
            seen.add(t)
            found.append(term.strip())

    # 1) multiword vocab phrases
    for phrase in sorted(MULTIWORD, key=len, reverse=True):
        if phrase in low:
            add(phrase)

    # 2) single-word vocab
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9\+\.#/-]*", jd)
    for tok in tokens:
        t = tok.lower().strip(".")
        if t in TECH_VOCAB:
            add(tok)

    # 3) capitalized multi-word phrases (e.g. "Event Grid", "Model Context Protocol"),
    #    but only if at least one word is a known tech term — this drops company names
    #    and job titles ("Acme Payments", "Senior Backend Engineer").
    for m in re.finditer(r"\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){1,3})\b", jd):
        phrase = m.group(1)
        words = [w.lower() for w in phrase.split()]
        if len(words) >= 2 and any(w in TECH_VOCAB for w in words):
            add(phrase)

    # 4) ALL-CAPS acronyms (>=2 letters), e.g. API, RBAC, SIEM
    for m in re.finditer(r"\b([A-Z]{2,6})\b", jd):
        ac = m.group(1)
        if ac.lower() not in STOPWORDS:
            add(ac)

    # filter obvious stopwords / too-short
    return [f for f in found if f.lower() not in STOPWORDS and len(f) > 1]


def term_present(term: str, resume_text_norm: str) -> bool:
    t = normalize(term)
    # Build a small set of surface variants so singular/plural and hyphen/space
    # differences don't cause false "missing" reports (this is advisory matching).
    variants = {t}
    if t.endswith("s"):
        variants.add(t[:-1])          # queues -> queue
    else:
        variants.add(t + "s")          # queue -> queues
    if " " in t:
        variants.add(t.replace(" ", "-"))   # message queue -> message-queue
        variants.add(t.replace(" ", ""))     # message queue -> messagequeue
    if "-" in t:
        variants.add(t.replace("-", " "))
        variants.add(t.replace("-", ""))
    for v in variants:
        pattern = r"(?<![A-Za-z0-9])" + re.escape(v) + r"(?![A-Za-z0-9])"
        if re.search(pattern, resume_text_norm):
            return True
    return False


def main():
    ap = argparse.ArgumentParser(description="Check JD keyword coverage in a resume.")
    ap.add_argument("--jd", required=True, help="Path to the job-description text file.")
    ap.add_argument("--resume", required=True, help="Path to the tailored JSON, .txt, or .pdf.")
    ap.add_argument("--extra-terms", default="", help="Comma-separated extra terms to force-check.")
    ap.add_argument("--json", action="store_true", help="Emit the report as JSON.")
    args = ap.parse_args()

    jd_path = Path(args.jd)
    resume_path = Path(args.resume)
    if not jd_path.exists():
        print(f"error: JD file not found: {jd_path}", file=sys.stderr); sys.exit(0)
    if not resume_path.exists():
        print(f"error: resume file not found: {resume_path}", file=sys.stderr); sys.exit(0)

    jd = jd_path.read_text(encoding="utf-8")
    resume_text = extract_resume_text(resume_path)
    resume_norm = normalize(resume_text)

    keywords = extract_jd_keywords(jd)
    for extra in args.extra_terms.split(","):
        if extra.strip() and extra.strip() not in keywords:
            keywords.append(extra.strip())

    present, missing = [], []
    for kw in keywords:
        (present if term_present(kw, resume_norm) else missing).append(kw)

    total = len(keywords)
    covered = len(present)
    pct = (100.0 * covered / total) if total else 100.0

    if args.json:
        print(json.dumps({
            "total": total, "covered": covered, "coverage_pct": round(pct, 1),
            "present": present, "missing": missing,
        }, indent=2))
        return

    print("=" * 60)
    print(f"JD KEYWORD COVERAGE: {covered}/{total} ({pct:.0f}%)")
    print("=" * 60)
    print(f"\n✓ PRESENT ({len(present)}):")
    print("  " + ", ".join(present) if present else "  (none)")
    print(f"\n✗ MISSING ({len(missing)}):")
    print("  " + ", ".join(missing) if missing else "  (none)")
    if missing:
        print("\nFor each MISSING term, decide:")
        print("  1. Does the candidate genuinely have this (per the superset)? "
              "-> surface it: pull the relevant bullet/skill from the superset, or")
        print("     rephrase an existing bullet to use the JD's exact wording.")
        print("  2. Not in the superset / no evidence? -> LEAVE IT OUT. Never fabricate.")
        print("     A gap is honest; a fabricated keyword is a liability.")
    print()


if __name__ == "__main__":
    main()
