# AI Quiz Platform: FAANG-Level Interview Preparation Dossier

## 1. PROJECT OVERVIEW

### Problem Statement (Real-World Pain Point)
Students and job-seekers preparing for technical interviews often face three gaps: low-quality random quiz content, no structured speaking practice, and weak feedback loops. Most tools test recall, not interview readiness.

### Target Users
- College students preparing for placements.
- Early-career engineers preparing for SWE interviews.
- Self-learners who need topic-wise practice, mock interviews, and progress tracking.
- Admin/mentor personas who need user-level analytics.

### Core Idea
Build a full-stack AI-assisted interview prep platform that combines:
- MCQ quiz generation + scoring + adaptive difficulty.
- Live open-ended interview evaluation.
- Resume-based interview simulation.
- Document/question-bank based interview simulation.
- Gamified progress, leaderboard, streaks, and achievements.

### Explanation in 3 Levels

#### 30 sec (Elevator Pitch)
This is an AI interview-prep platform where users can generate topic-based quizzes, practice live interview questions, and run resume/document-driven mock interviews. The system scores both objective and subjective responses, tracks user growth over time, and adds gamification to keep learning consistent.

#### 2 min (Structured Explanation)
The frontend is a React app with route-based modules for quiz setup, quiz attempt flow, dashboard analytics, live interview, resume interview, and document interview. The backend is an Express + MongoDB API with dedicated routes for auth, quiz, interview modes, leaderboard, reviews, and admin.

AI is used in controlled stages: generating questions, evaluating answers, parsing resume/document content, and producing summaries. To reduce hallucinations and protect UX, the backend adds validation layers, deterministic checks where possible, and fallback behaviors. Performance and abuse controls include response compression, rate limits, endpoint-specific AI throttling, lightweight response caching, and request timeouts.

The system stores rich attempt history (quiz details, interview feedback vectors, topic stats, accuracy trends) and turns that into dashboard insights. This gives both immediate practice and long-term growth visibility.

#### 5 min (Deep Technical Explanation) 
The architecture is a modular monolith:
- API entrypoint initializes security middleware (helmet/cors/compression), rate limits (global + AI + auth), request timeout guard, and lazy DB-connect middleware.
- Auth route handles registration/login/JWT lifecycle and records longitudinal user data (XP, streak, achievements, history).
- Quiz route generates AI MCQs, validates set quality (4 options, valid key, explanation quality, duplicate filtering), persists sessions, and computes multi-factor scoring.
- Interview route supports live open-ended Q&A with difficulty-aware minimum answer length and AI semantic evaluation.
- Resume/document interview routes support file upload, text extraction (pdf/doc/docx), AI parsing/question generation/evaluation, anti-cheat logs, and completion summaries.
- Leaderboard route serves day/all/topic boards, daily challenge generation with concurrency lock, and merged progress APIs.
- Admin route exposes platform analytics and per-user interview diagnostics.

Data model strategy:
- User is the aggregate root for identity + gamification + rollup analytics + curated history.
- Session models (QuizSession, ResumeInterview, DocumentInterview) preserve full attempt fidelity.
- LeaderboardEntry and DailyChallenge models support read-heavy ranking/challenge use-cases.

Interview-worthy engineering decisions:
- Deterministic correctness for MCQ evaluation in interview mode avoids relying on LLM correctness.
- Optional/non-blocking persistence for some paths protects user flow during transient DB issues.
- Cache with in-flight request coalescing reduces duplicate expensive reads.
- TTL cleanup on incomplete interview sessions controls storage growth.

---

## 2. REQUIREMENTS

### Functional Requirements
- User registration/login/profile management.
- JWT-protected authenticated APIs.
- Generate topic+difficulty based MCQ quizzes.
- Expand topic into AI-generated subtopics.
- Submit quiz answers and compute score, accuracy, speed, confidence metrics.
- Persist quiz sessions and detailed per-question result snapshots.
- Add completed attempts to leaderboard.
- View leaderboard by today/all/topic.
- Daily challenge generation and retrieval.
- Live open-ended interview start and iterative answer evaluation.
- Resume upload (PDF/DOCX/DOC), AI parse, question generation, answer evaluation, completion summary.
- Document upload (question bank style), extraction of Q/A pairs, interview generation, answer evaluation, completion summary.
- Anti-cheat signal logging (tab switch/fullscreen exits) for interview sessions.
- User progress dashboard with quiz and interview history, topic stats, current activity.
- Review publication and hero review listing.
- Admin login and admin overview/users/user profile analytics.
- Clear user data endpoint (password-protected destructive operation).

### Non-Functional Requirements
- Scalability:
  - Support gradual traffic growth using stateless API instances + externalized DB.
  - Handle AI-heavy endpoint spikes with separate rate limits.
- Performance:
  - Compression enabled.
  - Caching for read-heavy leaderboard/review/challenge endpoints.
  - Request timeout to avoid hung workers.
- Reliability:
  - Graceful degradation on DB connect failure (503 with retry messaging).
  - Route-level error handling and global error middleware.
  - Health endpoint with degraded state awareness.
- Security:
  - Helmet, CORS allowlist strategy, JWT auth.
  - Auth and API rate-limiting.
  - Input validation and normalization on key endpoints.
  - Destructive operations gated by password.

---

## 3. TECH STACK + DECISION JUSTIFICATION

### React (Frontend)
- What: SPA UI layer for multi-page interview workflows.
- Why chosen: fast dev velocity, component reuse, ecosystem maturity.
- Alternatives: Next.js, Vue, Angular.
- Why not alternatives now: SSR not mandatory for authenticated app flows; simpler CRA-style setup lowered complexity.
- Trade-offs:
  - Performance: good for SPA, but large bundles can hurt first load.
  - Scalability: frontend scales well behind CDN.
  - Complexity: moderate.
  - Cost: low infra cost.
- 100x check: yes with CDN + code splitting + route-level lazy loading.
- Crisp answer:
  - “I chose React because the product is highly interactive and stateful. The team needed quick iteration and component-level reuse across many interview modules. At scale, we would add code-splitting and edge caching to keep UX fast.”

### Node.js + Express
- What: API runtime and routing layer.
- Why chosen: same language across stack, rapid API iteration, strong ecosystem.
- Alternatives: Fastify, NestJS, Spring Boot, Django.
- Why not alternatives now: Nest/Spring add structure but increase initial overhead; Express gave flexibility and speed for MVP-to-growth.
- Trade-offs:
  - Performance: adequate, not max throughput vs Go/Java.
  - Scalability: horizontal scale friendly.
  - Complexity: low-to-medium.
  - Cost: low.
- 100x check: yes with stateless scaling, queue offload for AI jobs, and caching.
- Crisp answer:
  - “Express gave us fast time-to-market and enough control for middleware-heavy concerns like CORS, rate limits, and auth. For very high scale, we’d keep API stateless and push expensive AI workflows into async workers.”

### MongoDB + Mongoose
- What: primary persistence for users, sessions, leaderboard entries.
- Why chosen: document model fits variable AI response payloads and nested interview results.
- Alternatives: PostgreSQL, MySQL, DynamoDB.
- Why not alternatives now: relational schema evolution for highly nested AI structures would be slower in early phases.
- Trade-offs:
  - Performance: strong for document reads/writes; joins less native.
  - Scalability: built-in sharding path.
  - Complexity: schema discipline still required.
  - Cost: moderate depending on managed tier.
- 100x check: likely with indexing + read replicas + partitioning strategy; may split analytical queries to warehouse later.
- Crisp answer:
  - “MongoDB matched our nested, evolving interview payloads and reduced schema friction early. We still use indexes and bounded arrays to control growth. At larger scale, we’d separate OLTP and analytics workloads.”

### Axios
- What: HTTP client for both frontend and server AI calls.
- Why chosen: interceptors, timeout controls, simple ergonomics.
- Alternatives: fetch, superagent.
- Why not alternatives now: axios interceptors simplified token + global 401 handling.
- Trade-offs: minimal overhead vs native fetch.
- 100x check: fine; bottlenecks are network/AI latency, not client library.
- Crisp answer:
  - “Axios was chosen for robust interceptors and timeout handling. It simplified auth token propagation and centralized error behavior, which is critical in multi-endpoint flows.”

### JWT
- What: stateless auth tokens.
- Why chosen: easy stateless scaling across multiple API instances.
- Alternatives: server sessions, OAuth-only identity.
- Why not alternatives now: simpler custom auth requirement, low initial integration complexity.
- Trade-offs:
  - Performance: lightweight verification.
  - Scalability: strong for horizontal scaling.
  - Security: requires careful secret management and expiry policy.
  - Cost: low.
- 100x check: yes; add refresh token rotation and token revocation strategy.
- Crisp answer:
  - “JWT enables stateless auth and easy horizontal scaling. We use signed tokens with expiration and can evolve to refresh-token rotation for stronger security at scale.”

### Multer + pdf-parse + mammoth
- What: file upload + text extraction pipeline for resume/document interviews.
- Why chosen: practical support for common interview prep file formats.
- Alternatives: cloud document AI parsers.
- Why not alternatives now: vendor cost + integration overhead for initial version.
- Trade-offs: extraction accuracy may vary by file quality.
- 100x check: use async processing + object storage + OCR/document AI fallback.
- Crisp answer:
  - “We needed reliable PDF/DOCX ingestion quickly, so multer + parsers gave us a predictable pipeline. As volume and format variability grow, we’d shift parsing to async workers and specialized document AI services.”

### Security/Perf Middleware (helmet, cors, compression, express-rate-limit)
- What: baseline hardening and throughput improvements.
- Why chosen: battle-tested middleware with low implementation effort.
- Alternatives: custom middleware stack.
- Why not alternatives now: custom security middleware increases bug risk.
- Trade-offs: stricter defaults can need tuning for real clients/proxies.
- 100x check: yes with gateway/WAF support and distributed rate limiting.
- Crisp answer:
  - “We used standard hardening middleware to reduce attack surface quickly and consistently. It’s low cost, high impact, and production-friendly, especially when combined with endpoint-specific throttling.”

---

## 4. SYSTEM DESIGN

### High-Level Design (HLD)

```text
[User Browser (React SPA)]
        |
        | HTTPS REST (JWT)
        v
[Express API Gateway Layer]
  |-- /auth
  |-- /quiz
  |-- /interview
  |-- /resume-interview
  |-- /document-interview
  |-- /leaderboard
  |-- /reviews
  |-- /admin
        |
        +--------------------------+
        |                          |
        v                          v
 [MongoDB via Mongoose]       [AI Provider API]
 (User, sessions, ranking)    (Grok/Groq generation/evaluation)
```

### Component Interaction
1. Frontend calls API service methods with axios.
2. Request passes through auth/cors/rate-limit/timeout middleware chain.
3. Route handler validates payload and executes business logic.
4. If needed, route calls AI service module.
5. Route persists/reads from MongoDB models.
6. Response returned to frontend and rendered in module-specific page.

### Low-Level Design (LLD)

#### Modules / Classes
- Backend core modules:
  - index server bootstrap + middleware orchestration.
  - route modules per domain.
  - service module for AI interactions and parsing.
  - utility modules for scoring, validation, cache, document extraction.
- Data models:
  - User, QuizSession, ResumeInterview, DocumentInterview, LeaderboardEntry, DailyChallenge, Review.
- Frontend modules:
  - Auth context, API service wrapper, route-level pages.

#### APIs (Representative)
- Auth:
  - POST /api/auth/register
  - POST /api/auth/login
  - GET /api/auth/me
  - POST /api/auth/record-quiz
  - POST /api/auth/record-interview
- Quiz:
  - POST /api/quiz/generate
  - POST /api/quiz/submit
- Live interview:
  - POST /api/interview/start
  - POST /api/interview/answer
- Resume interview:
  - POST /api/resume-interview/upload
  - POST /api/resume-interview/generate-questions
  - POST /api/resume-interview/evaluate-answer
  - POST /api/resume-interview/complete
- Document interview:
  - POST /api/document-interview/upload
  - POST /api/document-interview/evaluate-answer
  - POST /api/document-interview/complete
- Leaderboard:
  - GET /api/leaderboard/today
  - GET /api/leaderboard/all
  - GET /api/leaderboard/progress/me

#### Database Schema (Condensed)
- User:
  - identity: email, password hash, displayName.
  - gamification: xp, level, streak, achievements.
  - aggregate stats: totalQuizzes, totalCorrect, totalInterviews.
  - analytics arrays: topicStats, accuracyHistory, quizHistory, interviewHistory.
  - live pointer: currentInterview.
- QuizSession:
  - sessionId, topic/difficulty, generated questions, user answers, score vector.
- ResumeInterview/DocumentInterview:
  - session metadata, parsed source content, generated question sets, response evaluations, anti-cheat logs, summary results.
- LeaderboardEntry:
  - userName, score/accuracy/finalScore, topic/difficulty/date.
- DailyChallenge:
  - unique date, generated questions set.

---

## 5. DATA FLOW (CRITICAL)

### A) Quiz Flow
1. User enters topic/difficulty/count in frontend quiz setup.
2. Frontend sends POST /quiz/generate.
3. Backend validates topic/count, optionally expands subtopics via AI.
4. Backend generates questions via AI service.
5. Validation layer filters malformed/hallucinated question structures.
6. Backend creates sessionId and stores QuizSession.
7. Frontend renders questions one-by-one; captures selected option, confidence, timeTaken.
8. Frontend sends POST /quiz/submit with answers.
9. Backend loads session, blocks duplicates, calculates score metrics, stores completion state.
10. Frontend calls leaderboard add and record-quiz endpoints.
11. Auth route updates user analytics, XP, streak, achievements, topic stats, and history.
12. Score page renders final results and recommendations.

### B) Live Interview Flow
1. User starts interview topic+difficulty.
2. Backend generates first open-ended question.
3. User submits answer.
4. Backend enforces minimum word threshold based on difficulty.
5. AI evaluates semantic quality against expected topics/reference answer.
6. Backend generates follow-up question using previous context.
7. Loop continues with updated questionNumber.

### C) Resume Interview Flow
1. User uploads resume file.
2. Backend validates file type/size and stores temp upload.
3. Text extraction from PDF/DOCX.
4. AI parses resume into structured profile.
5. Questions generated from parsed content and configured role/difficulty.
6. Each spoken answer is evaluated and stored with reference answer source.
7. Completion endpoint computes aggregate scores + AI summary.
8. Session finalized; user currentInterview cleared.

### Validation, Processing, Storage, Retrieval Coverage
- Validation:
  - Input guards (required fields, bounds, file-type checks, transcript length).
  - AI output validation for question structure.
- Processing:
  - Score algorithms, semantic evaluation, answer calibration.
- Storage:
  - Session-based records + user aggregate history.
- Retrieval:
  - Progress endpoints merge profile history + session collections for richer dashboards.

---

## 6. CODE WALKTHROUGH

### File 1: server/routes/quiz.js
Purpose:
- Handles quiz generation, submission, session retrieval, and topic expansion.

Key snippet:
```js
const rawQuestions = await generateQuizQuestions(topic.trim(), difficulty, numQuestions, subtopics);
const { validQuestions, issues } = validateQuestionSet(rawQuestions);
if (validQuestions.length === 0) {
  return res.status(500).json({ error: "AI generated questions failed validation. Please try again.", issues });
}
```
Line-by-line explanation:
1. Calls AI service to generate raw MCQs.
2. Passes output through anti-hallucination validator.
3. Hard-fails if everything is invalid instead of serving unsafe content.
Why this implementation:
- Protects user trust and product quality when LLM responses are noisy.

### File 2: server/utils/scoring.js
Purpose:
- Computes objective and behavioral quiz metrics in one place.

Key snippet:
```js
const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
const speedScore = Math.max(0, Math.min(100, Math.round(100 - (avgTime - 10) * 2)));
const finalScore = Math.round(accuracy * 0.7 + speedScore * 0.3);
```
Line-by-line explanation:
1. Converts raw correctness into normalized accuracy.
2. Converts response speed into bounded score.
3. Produces weighted composite score balancing quality and pacing.
Why this implementation:
- Encourages both correctness and interview-time discipline.

### File 3: server/routes/auth.js
Purpose:
- Identity APIs + persistent growth metrics + XP/achievement engine integration.

Key snippet:
```js
const user = await User.findByIdAndUpdate(req.userId, {
  $inc: { totalQuizzes: 1, totalCorrect: normalizedScore, totalQuestions: normalizedTotalQuestions }
}, { returnDocument: "after" });
```
Line-by-line explanation:
1. Atomic increment avoids race conditions under concurrent updates.
2. Updates durable aggregate metrics with one DB operation.
3. Returns updated document for follow-up business logic.
Why this implementation:
- Safer stats updates under concurrent client retries/tab usage.

### File 4: server/utils/responseCache.js
Purpose:
- In-memory response caching with in-flight request deduplication.

Key snippet:
```js
if (inFlightStore.has(key)) {
  const payload = await inFlightStore.get(key);
  return res.json(payload);
}
```
Line-by-line explanation:
1. Detects concurrent identical request.
2. Waits for first request’s promise instead of duplicating DB/API work.
3. Returns shared payload to all waiting callers.
Why this implementation:
- Prevents cache stampede and reduces backend/DB pressure.

### File 5: client_side/src/pages/QuizScreen.js
Purpose:
- Orchestrates quiz UX from generation to submit and post-submit side effects.

Key snippet:
```js
const res = await submitQuiz({ sessionId, answers: finalAnswers });
await addToLeaderboard({ userName, score: res.data.score, accuracy: res.data.accuracy, ... });
const xpRes = await recordQuiz({ sessionId, topic, difficulty, ...res.data });
```
Line-by-line explanation:
1. Submits answer payload for authoritative scoring.
2. Pushes ranking data to leaderboard route.
3. Persists long-term user growth data and updates local auth context.
Why this implementation:
- Keeps concerns separated: scoring, ranking, and progression each have dedicated endpoints.

---

## 7. ADVANCED ENGINEERING

### Design Patterns Used
- Modular monolith by domain routes.
- Middleware pipeline pattern for cross-cutting concerns.
- Service abstraction for AI provider interaction.
- Aggregation pattern in User model for dashboards.

### Caching / Indexing
- Response cache middleware for hot GET endpoints.
- Cache invalidation on leaderboard/review writes.
- DB indexes on sessionId/date/userName/topic patterns.
- TTL index on incomplete interview sessions.

### Performance Optimizations
- Compression middleware.
- Request timeout guard.
- Endpoint-specific rate limits for AI-heavy paths.
- In-flight request deduplication.
- Lean queries on read-heavy routes.

### Security Practices
- Helmet + CORS allowlist.
- JWT auth middleware.
- Auth and AI route rate limiting.
- Password check before account data wipe.
- Basic validation of transcript lengths and topic fields.

### Error Handling Strategy
- Local try/catch per route with meaningful status codes.
- Global error middleware fallback.
- Graceful fallback for optional non-critical writes.
- Health endpoint supports degraded state reporting.

---

## 8. FAILURE SCENARIOS & DEBUGGING

1. AI API timeout during question generation
- Root cause: provider latency/network issues.
- Detection: elevated 5xx + timeout logs in quiz/interview routes.
- Fix: retry with bounded attempts + fallback prompt/shorter token output.
- Prevention: circuit breaker and async queue.
- Interviewer challenge: “What will you do if AI is down in production?”

2. MongoDB unavailable at request time
- Root cause: cluster outage or auth/network issue.
- Detection: connect errors + spike in 503 responses.
- Fix: fast-fail with retry guidance; auto-reconnect.
- Prevention: managed DB HA + alerting.

3. Duplicate quiz submissions
- Root cause: user double-click/retry race.
- Detection: repeated submit calls for same sessionId.
- Fix: completed flag with 409 rejection.
- Prevention: idempotency keys and frontend button lock.

4. Invalid AI JSON response
- Root cause: model returns markdown or malformed JSON.
- Detection: parse exceptions and validation failure counters.
- Fix: parse fallback extraction + strict schema validation.
- Prevention: stronger system prompts + JSON mode if supported.

5. Cache stale leaderboard data
- Root cause: missing invalidation after writes.
- Detection: user reports stale ranks; compare DB vs API output.
- Fix: invalidateByPrefix on add paths.
- Prevention: integration tests around write-read consistency.

6. File upload parsing fails
- Root cause: corrupted PDF/unsupported encoding.
- Detection: extraction errors and low-text-length checks.
- Fix: reject with user-friendly feedback.
- Prevention: pre-validation + OCR fallback service.

7. JWT secret misconfiguration in production
- Root cause: env var missing.
- Detection: boot-time fatal log.
- Fix: set secret, rotate compromised tokens.
- Prevention: startup config validation in CI/CD.

8. CORS blocks legitimate frontend domain
- Root cause: incomplete allowlist.
- Detection: browser CORS errors + backend warning logs.
- Fix: add normalized origin and deploy.
- Prevention: environment-specific origin tests.

9. User analytics race causing inconsistent XP/level
- Root cause: concurrent updates from multiple tabs/devices.
- Detection: mismatch between expected and stored totals.
- Fix: atomic updates and event ordering.
- Prevention: transactional update strategy for critical counters.

10. Memory pressure from in-memory cache
- Root cause: traffic burst + large payloads.
- Detection: high heap usage, GC churn.
- Fix: enforce max cache entries and prune aggressively.
- Prevention: shift to Redis with TTL + eviction policy.

11. Interview evaluation quality drift
- Root cause: model behavior shifts over time.
- Detection: manual QA score variance + user dissatisfaction.
- Fix: prompt tuning + calibration datasets.
- Prevention: periodic regression benchmarking for evaluation prompts.

12. Anti-cheat false positives
- Root cause: browser/OS behavior triggering focus changes.
- Detection: unusual warning spikes on specific browsers.
- Fix: threshold-based warnings rather than hard fail.
- Prevention: tune sensitivity with telemetry.

---

## 9. METRICS & PERFORMANCE

### Core Metrics
- Latency: request round-trip time; track p50/p95/p99 per endpoint.
- Throughput: requests per second per route group.
- Error rate: 4xx/5xx ratio and absolute failure counts.

### Project-Specific Targets (Reasonable Baselines)
- GET cached leaderboard: p95 < 120ms.
- Quiz generation (AI dependent): p95 < 5s.
- Quiz submission scoring: p95 < 400ms.
- Resume/doc evaluation endpoints: p95 < 8s.
- Error rate target: < 1% non-user-induced failures.

### Likely Bottlenecks
- External AI inference latency.
- Parsing large upload documents.
- High cardinality dashboard aggregation reads.

### Optimization Strategies
- Precompute frequent analytics.
- Move heavy AI tasks to queue workers.
- Add Redis for distributed cache/rate limit state.
- Use projection/lean queries and tighter indexes.
- Introduce read replicas for analytics-heavy GET APIs.

### How to Measure + Why It Matters
- Measure via:
  - structured request logs with route + latency + status.
  - APM traces around AI calls and DB operations.
  - dashboard panels for error budget burn.
- Why:
  - Interview prep product UX is highly latency-sensitive; long waits reduce practice completion and retention.

---

## 10. SCALABILITY ROADMAP

### Stage 1: Local / Early MVP
- Single API instance + single Mongo instance.
- In-memory cache and local uploads.
- Minimal observability via logs.

### Stage 2: 1K users
- Deploy managed MongoDB.
- Containerize API and run 2-3 instances.
- Add centralized logging and basic alerts.
- Move uploads to object storage.

### Stage 3: 100K users
- Introduce Redis for cache + distributed rate limiting.
- Queue AI-heavy operations (BullMQ/SQS).
- Split read-heavy analytics endpoints from write APIs.
- Add CDN + frontend code splitting.

### Stage 4: 1M+ users
- Service decomposition:
  - Auth/Profile service
  - Assessment service
  - AI orchestration service
  - Analytics pipeline
- DB scaling:
  - sharded/session-partitioned stores.
  - event stream to warehouse for analytics.
- Infra:
  - multi-region read replicas.
  - global load balancing + failover.
  - strict SLO/SLA governance.

---w

## 11. ALTERNATIVE DESIGNS

### Monolith vs Microservices
- Monolith pros: simpler deployment, easier local dev, lower operational overhead.
- Monolith cons: larger blast radius, scaling granularity limited.
- Microservices pros: independent scaling/deployments, team autonomy.
- Microservices cons: higher complexity (observability, networking, consistency).
- Use monolith now; migrate selective domains later (AI jobs, analytics).

### SQL vs NoSQL
- SQL pros: strong consistency, relational integrity, rich joins.
- SQL cons: schema rigidity for evolving AI payloads.
- NoSQL pros: flexible nested documents, rapid schema evolution.
- NoSQL cons: less join ergonomics and stricter discipline needed for data integrity.
- Current fit: NoSQL for session-heavy variable payloads; add SQL/warehouse for reporting if needed.

### REST vs GraphQL
- REST pros: simple caching/rate-limiting semantics, easier endpoint governance.
- REST cons: over/under-fetching risk.
- GraphQL pros: flexible client queries and reduced over-fetching.
- GraphQL cons: complexity in auth/caching/observability for beginners.
- Current fit: REST is adequate; GraphQL can be introduced for dashboard aggregation later.

---

## 12. INTERVIEW QUESTIONS

### Basic
1. What problem does your platform solve better than a normal quiz app?
2. Walk me through your end-to-end architecture.
3. How do you authenticate and authorize users?
4. How does quiz generation work?
5. How are scores computed?

### Intermediate (WHY-based)
6. Why did you choose MongoDB for this product?
7. Why keep both session-level data and aggregate user history?
8. Why separate AI and auth rate limits?
9. Why do you validate AI outputs after generation?
10. Why is some DB persistence non-blocking?

### Advanced (scaling, trade-offs)
11. How would you scale this to 100K daily active users?
12. What is your strategy when AI providers become unstable or expensive?
13. How would you redesign leaderboard for very high write throughput?
14. What consistency guarantees are required for XP and achievements?
15. How would you reduce dashboard query cost at scale?

### Deep Technical (code, DB, APIs)
16. Explain your in-flight cache deduplication logic.
17. How do you prevent duplicate quiz submission races?
18. What indexes are critical and why?
19. How does difficulty-aware interview validation work?
20. Where can this code still fail in production despite current safeguards?

### Follow-ups (drill deeper)
21. Why not use event sourcing for user progression?
22. What would you move to async first and why?
23. How would you test prompt regressions?
24. Which endpoint has highest p99 risk and how would you fix it?
25. If the DB is down, which features should continue and which must stop?

---

## 13. ANSWERS

### Q1: What problem does your platform solve better than a normal quiz app?
Crisp:
- It combines objective quiz practice with subjective interview simulation and longitudinal feedback.
Expanded:
- Standard quiz apps optimize for recall. This platform also evaluates communication, relevance, semantic quality, and role-specific readiness through resume/document/live interview workflows, making it interview-prep complete.

### Q2: Why MongoDB here?
Crisp:
- Interview sessions have nested, evolving payloads, so document storage reduced schema friction.
Expanded:
- Resume/document responses contain variable evaluation fields and arrays. Mongo made iteration fast while still supporting indexes and bounded history arrays for performance.

### Q3: Why validate AI output post-generation?
Crisp:
- LLM output is probabilistic; production systems need deterministic quality gates.
Expanded:
- We enforce option count, answer key correctness, explanation quality, and de-duplication before serving content. This protects trust and avoids silent quality regressions.

### Q4: How does scoring balance correctness and speed?
Crisp:
- Final score is weighted 70% accuracy and 30% speed.
Expanded:
- Accuracy measures conceptual correctness while speed incentivizes interview pacing. We also compute confidence calibration to detect overconfidence behavior.

### Q5: How do you handle heavy AI endpoint abuse?
Crisp:
- We use endpoint-specific rate limits stricter than general API limits.
Expanded:
- AI routes have independent quotas and can be isolated further behind queue workers, protecting the rest of the platform from expensive burst traffic.

### Q6: How do you avoid duplicate submission bugs?
Crisp:
- Session completion flag and conflict response enforce idempotency-like behavior.
Expanded:
- Submit checks completed state and returns 409 on repeat. Frontend also locks flow, but backend guard is the source of truth.

### Q7: What would you refactor first for 100K users?
Crisp:
- Move AI-heavy workflows to asynchronous job processing.
Expanded:
- Upload parse and interview evaluation are highest latency paths. Queueing them improves API responsiveness, failure isolation, and cost control.

### Q8: What is your failure handling strategy?
Crisp:
- Fast fail for hard dependencies, graceful degradation for optional operations.
Expanded:
- If DB isn’t available, core APIs return 503 quickly; some non-critical writes log warnings while preserving user flow. Health endpoint exposes degraded mode.

### Q9: Why keep both session tables and user history arrays?
Crisp:
- Session tables retain full fidelity; user arrays speed up dashboard reads.
Expanded:
- This hybrid model avoids expensive joins for common profile dashboards while preserving raw records for deep analysis and admin debugging.

### Q10: How do you secure destructive operations?
Crisp:
- Require auth plus password verification before data wipe.
Expanded:
- JWT alone isn’t enough for dangerous actions. Re-auth style password check reduces account-takeover blast radius.

---

## 14. STORYTELLING MODE (HR + TECH)

I observed that many students could solve MCQs but still underperformed in interviews because they lacked structured speaking practice and actionable feedback. So I built an AI interview-prep platform, not just a quiz app.

The first challenge was reliability of AI output. Generated questions were occasionally malformed, so I added a deterministic validation layer and fallback parsing. The second challenge was handling long-running AI workflows and file parsing without hurting UX. I addressed that with route-specific throttling, request timeouts, and modular workflows for quiz/live/resume/document modes.

Then I focused on user growth and retention: XP, streaks, achievements, and rich progress dashboards. This transformed one-off practice into a continuous learning loop. The result is a production-oriented platform that combines product thinking, backend reliability, and interview-focused pedagogy.

---

## 15. EDGE CASES & COMMON MISTAKES

- Empty/low-content resume file passes upload but fails semantic parsing.
- AI returns JSON-looking text with hidden control chars.
- User opens same quiz in multiple tabs and submits from both.
- Topic names with regex special chars break topic leaderboard filters if not escaped.
- Huge transcripts can blow request payload or evaluation latency.
- CORS mismatch between preview/prod deployment URLs.
- currentInterview pointer gets stale if completion write fails midway.
- Achievements can drift without strict idempotent award logic.
- In-memory cache state is lost on restart; stale assumptions in clients.
- Admin credentials in env defaults are weak if not overridden.

Handling strategy:
- validate early, bound payload sizes, deterministic guards, and explicit cleanup/recovery paths.

---

## 16. FUTURE IMPROVEMENTS

- Production architecture:
  - Redis cache + distributed rate limiting.
  - async worker queue for AI tasks.
  - object storage + signed URLs for uploads.
- Product intelligence:
  - personalized learning path recommendation.
  - weak-topic spaced repetition.
  - interviewer persona simulation (backend/system design/HR styles).
- Reliability:
  - full observability stack (traces, metrics, alerting).
  - contract tests for AI output schemas.
  - chaos testing for dependency outages.
- Security:
  - refresh token rotation.
  - stricter admin auth (MFA/IP allowlist).
  - audit logs for critical admin actions.

---

## 17. MOCK INTERVIEW MODE (INTERACTIVE)

Use this script with me:
1. I ask one question only.
2. You answer in 60-120 seconds structure.
3. I evaluate:
   - Clarity (0-10)
   - Depth (0-10)
   - Trade-off reasoning (0-10)
   - Communication (0-10)
4. I give improvement pointers.
5. I provide ideal answer.
6. Move to next question.

Start Question 1:
- “Explain your quiz generation pipeline and specifically how you prevent low-quality or hallucinated AI questions from reaching users.”

---

## 18. STRESS / ADVERSARIAL MODE

Strict interviewer script:
- “You said your AI evaluation is reliable. Why should I trust that?”
- “No, that sounds generic. Tell me exactly which checks are deterministic.”
- “What breaks if MongoDB is down while a user submits a completed interview?”
- “You are using in-memory cache. How does this work in multi-instance deployments?”
- “Why didn’t you use queues from day one? Was this a design miss?”
- “Give me one hard trade-off you made and what metric worsened because of it.”

How to respond:
- lead with direct answer, then mechanism, then trade-off, then mitigation.

---

## 19. CODE REBUILD TEST

Rebuild tasks from memory:
1. Re-write quiz scoring function:
   - inputs: questions, answers
   - outputs: accuracy, speedScore, finalScore, confidenceStats, weak/strong topics
2. Re-write AI question validation function:
   - enforce 4 options, valid answer key, non-empty explanation, dedupe by normalized question text
3. Re-write auth middleware:
   - read bearer token
   - verify JWT
   - attach userId
   - return 401 on failure
4. Re-write response cache middleware with in-flight request sharing.

For each rebuild, explain:
- why each line exists
- what bug appears if removed
- performance/security implication

---

## 20. RAPID REVISION SHEET

### 60-Second Recall
- Architecture: React SPA -> Express API -> MongoDB + AI provider.
- Core differentiator: quiz + live interview + resume/document interview in one loop.
- Safety: AI output validation + deterministic checks + rate limits.
- Reliability: timeout guard, DB connect guard, graceful fallback paths.
- Growth loop: XP, streak, achievements, topic stats, rich history.

### Key Formulas / Concepts
- Accuracy = (correct / total) * 100
- FinalScore = 0.7 * Accuracy + 0.3 * SpeedScore
- Confidence calibration: penalize high-confidence wrong answers.
- p95 latency is primary UX health signal for AI endpoints.

### High-Value One-Liners
- “LLMs are probabilistic; production APIs must be deterministic at the boundaries.”
- “I separated session fidelity from user aggregates to optimize both analytics depth and dashboard read performance.”
- “Endpoint-specific throttling protects expensive AI capacity without harming core platform availability.”
- “At scale, my first move is async AI orchestration with queue-backed workers and Redis-backed controls.”

### Night-Before Interview Checklist
- Practice 3 versions of architecture explanation: 30 sec, 2 min, 5 min.
- Memorize 3 trade-offs you made intentionally.
- Be ready with 2 real production failure stories and mitigations.
- Rebuild scoring + validation logic from memory once.
- Answer at least 5 adversarial “why” chains without hand-waving.
