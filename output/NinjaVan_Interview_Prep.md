# Ninja Van — Company, Stack & Interview Research

> Prep dossier for the **Full Stack Developer** role (founding India tech lab). Ninja Van = the SEA logistics/logtech company — not "TCS Ninja" / "Coding Ninja" (unrelated, excluded).
> Compiled 2026-07-15.

---

## 1. Company snapshot
- SEA express-logistics (logtech) startup, founded **2014, Singapore**. ~2M parcels/day, **250M API requests/day, 3TB data/day**, 2600+ hubs across 6 markets (SG, MY, ID, TH, VN, PH). Raised >US$500M over five rounds.
- Target role = **founding engineering team, new India tech lab** (Hyderabad is their India base). Greenfield, high-ownership, "build the foundations and the engineering culture" framing.
- Comp signal: SWE median ≈ **₹18.4L/yr** total comp (levels.fyi, India). Senior full-stack Hyderabad listings ask 4+ yrs; this JD variant asks **3+ yrs (mandatory)**.

---

## 2. Engineering stack
JD-stated + corroborated by their Google Cloud case study and Ninja Van Tech engineering blog.

| Layer | Tech |
|---|---|
| **Backend** | **Golang** (preferred), Java 8+ (Play), Node.js, Python, FastAPI |
| **Frontend** | ReactJS, AngularJS |
| **Data stores** | **MySQL, TiDB** (MySQL-compatible distributed SQL), **Elasticsearch**, Delta Lake |
| **Cache** | Redis, Hazelcast |
| **Streaming / CDC** | **Apache Kafka**, Spark Streaming, Maxwell/Debezium, TiCDC, PySpark |
| **Orchestration** | **Kubernetes on GKE** — ~200 microservices / 15 clusters, KEDA autoscaling, Skaffold |
| **Containers** | Docker, Containerd |
| **CI/CD** | Atlassian suite — Jira, Confluence, Bitbucket, **Bamboo**; SonarQube quality gates |
| **Observability** | **Prometheus, Grafana, Thanos**; ELK (Elasticsearch / Fluentbit / Kibana) |
| **Cloud** | **GCP** (primary), AWS |
| **Query / workflow** | Apache Spark, Trino, Apache Airflow |

**Takeaway:** the spine is **Go + microservices + Kafka + GKE + MySQL/TiDB**. Near-daily deploys, strict unit-test coverage enforced via SonarQube.

---

## 3. Interview process
General Ninja Van SWE flow (candidate-reported). The brand-new India founding team may compress or reorder rounds.

1. **Online Assessment (HackerRank)** — ~16 questions in **1 hour**: 15 MCQ (data structures + OS / CS fundamentals) + **1 LeetCode-medium coding** question. Reported as harder-than-usual for a first round (concepts + medium coding up front).
2. **Recruiter screen (~20 min)** — culture fit, communication, project walk-through. *~70% reportedly filtered here — culture & communication weighted heavily.*
3. **Engineering-team technical round** — live coding on a shared editor + role depth (backend → database / API / system design).
4. **CTO round** — technical + engineering judgment.
5. **Engineering VP round** — team placement / final fit.

Middle rounds (eng team + CTO) are the most technical. Average ~14 days start-to-offer.

---

## 4. Technical questions
Candidate-reported + role-typical for this stack.

### Coding / DSA (OA + live)
- Reverse a linked list.
- Binary search → dynamic programming range of difficulty (revise DS&A fundamentals).
- Implement `exponent()` **without** the math library; analyze time complexity.
- Card game — "return the winner."
- **Postfix → prefix** expression conversion.
- Logistics-flavored: *"optimize a delivery route across a list of addresses"*; *"detect duplicate parcels in the system."*

### Backend / system design (their favorite territory)
- Optimize a slow SQL query — `EXPLAIN ANALYZE`, spotting sequential scans / missing indexes.
- Design a REST API + **microservices**: API Gateway role, **rate limiting**, REST vs SOAP, HTTP status codes, CORS.
- Concurrency: **goroutines** (Go) / virtual threads (Java, Project Loom) — why they're cheap, how many can run.
- Observability — three pillars: metrics, logs with correlation IDs, distributed traces (OpenTelemetry).
- Design patterns, SDLC, procedural vs functional programming.

### Frontend (full-stack)
- Browser / rendering questions, React state & lifecycle, front-end vs back-end responsibilities.

---

## 5. HR / behavioral / culture-fit
Ninja Van explicitly hires the "**pioneer**" engineer — high **initiative**, likes a modern stack, active in **open-source / GitHub / side projects**. Expect:

- **"Why Ninja Van *specifically*?"** — they check that you researched them. Non-negotiable.
- Walk me through a personal or open-source project — what did you own end-to-end?
- Tell me about a challenging bug you fixed / how you optimize performance.
- A time you resolved a team conflict.
- Founding-team framing: comfort with greenfield, deadlines, ambiguity, "no one tells you what to do," and rolling up sleeves across teams.

---

## 6. Prep tips — tailored to Priyanka's profile

### Lean into (strong fit)
- **9,300★ / 120+ merged PR open-source** record + GitHub projects (Lila full-stack game, TODO REST API) = exactly their "pioneer + initiative + OSS" filter. Lead with it in the recruiter and VP rounds.
- **Go microservices + Kafka event-driven + gRPC + PostgreSQL** map ~1:1 to their spine. Rehearse the Gin REST microservice and the Kafka + DLQ pipeline as system-design stories.
- Prep a crisp **"Why Ninja Van"**: founding India lab + logistics scale (250M req/day) + wanting ownership on a modern Go stack.

### Brush up (gaps / adjacents)
- **TiDB** — you know MySQL/PostgreSQL; read TiDB basics (distributed, MySQL-compatible, HTAP). Same idea for **Hazelcast** ≈ your Redis.
- **Prometheus / Grafana** — you use Datadog / OpenTelemetry (same concepts); skim PromQL + Grafana dashboards so the vocabulary matches.
- **Java / Play** — you're Go-first (their preference); be honest that Java is lighter for you, don't oversell.
- One **LeetCode-medium/day** (arrays, strings, linked list, DP, binary search) for the timed OA; practice `EXPLAIN ANALYZE` query-tuning out loud.

---

## Sources
- [Glassdoor — Ninja Van Software Engineer interviews](https://www.glassdoor.com/Interview/Ninja-Van-Software-Engineer-Interview-Questions-EI_IE984783.0,9_KO10,27.htm)
- [Medium [de]coded — What Ninja Van looks for in software engineers in SEA](https://medium.com/de-coded/what-ninja-van-looks-for-in-software-engineers-in-southeast-asia-af80c68e7700)
- [Google Cloud — How Ninja Van ran microservices in GKE](https://cloud.google.com/blog/products/application-modernization/how-ninja-van-ran-business-critical-apps-and-microservices-in-gke)
- [JustCrackInterview — Ninja Van questions](https://www.justcrackinterview.com/job-interviews/ninja-van/)
- [Ninja Van Tech (engineering blog)](https://medium.com/ninjavan-tech)
- [levels.fyi — Ninja Van SWE salary](https://www.levels.fyi/companies/ninja-van/salaries/software-engineer)
- [Ninja Van Tech careers](https://tech.ninjavan.co/joinus)

> **Confidence note:** rounds and questions are candidate-reported (Glassdoor / blogs) and reflect Ninja Van's *general* SWE hiring — the brand-new India founding team may compress or reorder rounds. The OA format and the 4-stage recruiter → eng team → CTO → VP flow are the best-corroborated.
