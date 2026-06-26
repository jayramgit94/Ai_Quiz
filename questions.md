1. Explain your project in 2 minutes.

Answer:
 I built an AI interview-prep platform because most quiz apps only test recall, not interview readiness. The problem I saw was that candidates can solve MCQs but still struggle to explain answers under pressure. So I combined four flows in one product: AI-generated quizzes, live open-ended interview Q and A, resume-based interviews, and document-based mock interviews. On the front end it is React with route-level pages for quiz, interview, dashboard, and leaderboard, and I use a centralized Axios client for auth and errors. The backend is Express with MongoDB, and the AI logic sits behind dedicated service functions so routes stay clean. The core loop is: generate content, validate it, store a session, then evaluate answers and update user stats. I measure accuracy, speed, and confidence so the feedback is more realistic than just right or wrong. A real bug I hit early was that AI responses sometimes came back with malformed options, so I added a strict validation layer and hard-fail behavior instead of showing broken questions. The impact is that a user gets adaptive practice plus long-term progress tracking and gamified motivation, which feels closer to real interview prep than a static question bank.



2. Why did you build this project?


Answer:
 I built it because I personally felt the gap between practicing questions and being interview-ready. Most tools either do MCQs without realism or do mock interviews without structured analytics. I wanted a system that simulates the pressure of answering out loud and still gives measurable feedback. The AI evaluation helps score open-ended answers and generate follow-ups, while the quiz mode gives objective accuracy and speed data. I added gamification like leaderboards and daily challenges so people actually stick with practice. The tricky part was balancing AI flexibility with reliability; I initially trusted the AI output too much and it produced inconsistent question structures, so I added validation and retries to keep UX clean. So the project is my attempt to make interview prep realistic, trackable, and motivating.


3. Why React?

Answer:
 I chose React because the product is a highly interactive SPA with multiple flows that share UI patterns. I needed reusable components like nav, cards, and progress blocks, and React makes that clean. React Router gives me client-side routing without reloading, which keeps the interview flow smooth. The ecosystem also made it easy to add animation and icons. In practice, React helped me ship fast and keep state predictable across pages. I did have to watch out for re-renders in the quiz screen, especially when the timer and selected options updated, so I isolated state and kept expensive computations memoized. That trade-off felt worth it for the speed of development and UX.


4. Why Node.js?


Answer:
 I picked Node.js because the backend is I/O heavy: database reads, file uploads, and AI API calls. Node handles that non-blocking flow well without needing a lot of threads. Using JavaScript on both ends also reduced friction when shaping payloads and validation rules. Express lets me compose middleware for auth, rate limiting, and timeouts quickly. I also liked how easy it is to deploy Node on serverless or standard servers. The main challenge was handling slow AI calls, so I added request timeouts and endpoint-specific rate limits so the server stays responsive under load.

5. Why MongoDB?


Answer:
 I used MongoDB because the interview and quiz data is nested and evolves as features grow. A document model maps nicely to a quiz session with questions, answers, and metrics in one place. I still keep a User collection as the aggregate root with summary stats and references to sessions. It is easier to add new fields like anti-cheat logs or AI feedback without migrations every time. I also index fields like email and leaderboard date so reads stay fast. If this scales further, I can split analytics into a separate store while keeping MongoDB for transactional data.


6. Explain complete project architecture.


Answer:
 The frontend is a React SPA with route-level pages for quiz, interview, dashboard, and admin flows. All API calls go through a centralized Axios client that injects JWT tokens and handles 401s. Requests hit an Express server that runs security middleware, rate limiting, and a DB readiness guard. Each domain has its own route module: auth, quiz, interview, resume, document, leaderboard, reviews, and admin. The AI layer is a service module that handles prompt creation, API calls, and response parsing, so route handlers stay focused on request validation and persistence. MongoDB stores Users, QuizSession, Interview sessions, LeaderboardEntry, DailyChallenge, and Review. The flow is: client request -> controller -> AI service or DB -> validation -> persistence -> response back to client.




11. What happens when React component re-renders?

Answer:
 A React component re-renders when its state changes, its props change, or its parent re-renders and passes new props. React builds a new virtual DOM tree, diffs it with the previous tree, and updates only the changed parts in the real DOM. In my project, the quiz screen re-renders on timer ticks and option selection, so I had to keep the state as small as possible. I also avoided re-creating handlers on every render for components that get repeated per question.



12. How do you avoid unnecessary re-renders?

Answer:
 I avoid unnecessary re-renders by keeping state local, memoizing heavy computations with useMemo, and memoizing callbacks with useCallback when passing handlers to child components. For pure components, I use React.memo so they only re-render if props actually change. In the quiz UI, I separated the timer from the question list so that ticking does not re-render the entire list. The key is to measure and only optimize the hotspots, not every component.



13. Why use React Router?

Answer:
 React Router lets me keep the app as a single-page application while still giving users distinct URLs for each flow. That makes navigation fast without full page reloads. It also lets me protect routes like dashboard and admin with auth logic. For this project, it keeps interview sessions smooth because the UI does not reset on each transition.



14. What is useEffect?


Answer:
 useEffect lets me run side effects after a render, like fetching data or syncing to local storage. In my app, I use it to load dashboard stats, fetch leaderboards, and persist user theme settings. It also gives me a way to clean up listeners or timers when a component unmounts. I treat it like a lifecycle hook: render first, then run the effect.



15. Explain Express middleware.

Answer:
 Express middleware are functions that run in sequence before the final route handler. I use them for security headers, CORS, JSON parsing, rate limiting, and auth. For example, the auth middleware reads the JWT, verifies it, and attaches userId to the request. If it fails, it short-circuits with a 401. This pipeline keeps routes clean, because each route focuses on business logic. I also added a timeout middleware so hung AI requests do not block the server.



16. Why centralize Axios?


Answer:
I centralized Axios so every request automatically includes the JWT token and consistent headers. It also gives me a single place to handle 401 errors, clear auth state, and redirect to login. That reduces duplicated logic across pages. It also makes it easy to set timeouts per request type, like longer timeouts for resume parsing. The code is cleaner and the behavior is consistent.



17. How does API communication work?

Answer:
The client calls an Axios function that hits an Express route. The request passes through auth and rate limit middleware, then lands in a controller that validates input. The controller calls a service for AI tasks or reads data from MongoDB. After processing, it saves sessions or user stats and sends a JSON response back. If an error occurs, it is caught by the global error handler so the client gets a clean message. That consistent flow helps debugging and keeps the API predictable.



18. Explain JWT authentication.

Answer:
1. The Live Script (The 1% Answer): On login, the server verifies the password and signs a JWT containing the user id and expiry. The client stores it and sends it on every request in the Authorization header. The server verifies the token in auth middleware before allowing protected routes like leaderboard or dashboard. If verification fails, the request is rejected with 401. This keeps the API stateless and easy to scale.
2. The "Average Candidate" Trap: They say "JWT is used for auth" with no flow.
3. The Top 1% Secret Sauce: I mention token creation, storage, header usage, and middleware verification.

19. Why JWT instead of sessions?

Keywords:

Stateless
Scalable

Answer:
1. The Live Script (The 1% Answer): I chose JWT because it keeps the server stateless, which makes horizontal scaling easier. With sessions, I would need shared storage like Redis and handle session invalidation. JWT also works well for serverless deployments. The trade-off is that token revocation is harder, so I keep expiry short and plan for refresh token rotation if needed.
2. The "Average Candidate" Trap: They say "JWT is better" without mentioning trade-offs.
3. The Top 1% Secret Sauce: I explain the session store trade-off and token revocation risk.

20. What is inside JWT?

Keywords:

User ID
Role
Expiry

Answer:
1. The Live Script (The 1% Answer): The JWT payload includes the user id, sometimes a role, and an expiry timestamp. It is signed so the server can verify it has not been tampered with. I keep it minimal to avoid putting sensitive data inside. The server uses the user id to fetch profile or apply authorization rules.
2. The "Average Candidate" Trap: They say "token has user info" without mentioning expiry or signing.
3. The Top 1% Secret Sauce: I mention minimal payload and security concerns about storing sensitive data.

21. What if token expires?

Keywords:

Logout
Refresh token
MongoDB

Answer:
1. The Live Script (The 1% Answer): If the token expires, the API returns 401 and the client clears auth state and sends the user to login. That is already implemented via an Axios interceptor. For a production-ready version, I would add refresh tokens stored securely and rotate them to avoid forcing logins too often. The user data remains in MongoDB, so no data is lost, just the session is re-authenticated.
2. The "Average Candidate" Trap: They say "user logs in again" without mentioning how it is handled in the client.
3. The Top 1% Secret Sauce: I mention the Axios interceptor behavior and future refresh token rotation.

22. Explain database schema.

Keywords:

User
QuizSession
Leaderboard
Interviews

Answer:
1. The Live Script (The 1% Answer): The User model holds identity plus gamification and aggregate stats like total quizzes and accuracy history. QuizSession stores each quiz attempt with questions, answers, timing, and computed scores. ResumeInterview and DocumentInterview store session data plus AI evaluations and summaries. LeaderboardEntry is optimized for ranking queries by date and topic. This separation keeps heavy session data out of the User document while still allowing quick profile insights.
2. The "Average Candidate" Trap: They list collections without explaining what goes where.
3. The Top 1% Secret Sauce: I explain why User is aggregate and sessions are separate.

23. Why separate collections?

Keywords:

Maintainability
Query efficiency

Answer:
1. The Live Script (The 1% Answer): Separate collections keep documents small and queries fast. User stays lightweight for frequent reads, while session collections handle large nested payloads. It also simplifies maintenance because each workflow has its own schema. For example, leaderboard queries do not need to scan large interview histories.
2. The "Average Candidate" Trap: They say "for organization" without mentioning query performance.
3. The Top 1% Secret Sauce: I connect it to document size and read patterns.

24. Which fields should be indexed?

Keywords:

Email
UserId
Rankings

Answer:
1. The Live Script (The 1% Answer): Email should be indexed and unique for login. UserId fields in session collections should be indexed for fast user history queries. LeaderboardEntry should be indexed on date and topic to support daily and topic-based ranking. If I add admin analytics, I would also index createdAt timestamps.
2. The "Average Candidate" Trap: They say "index frequently searched fields" without naming any.
3. The Top 1% Secret Sauce: I give concrete fields and the exact query reasons.

25. What is indexing?

Keywords:

Faster search
Reduced scan
AI Integration

Answer:
1. The Live Script (The 1% Answer): Indexing is a data structure that lets the database find documents faster without scanning the entire collection. It improves read performance at the cost of extra write time and storage. In this project, indexes on email or leaderboard date let me serve login and ranking queries quickly. It is a standard trade-off between read speed and write overhead.
2. The "Average Candidate" Trap: They say "indexing makes it fast" without trade-offs.
3. The Top 1% Secret Sauce: I mention read vs write trade-off and storage cost.

26. How does AI generate questions?

Keywords:

Prompt
Response
Validation

Answer:
1. The Live Script (The 1% Answer): The server builds a structured prompt with topic, difficulty, and count, and asks the AI to return JSON. The AI responds with question objects including options, correct answer, and explanation. I parse the response and validate the structure before storing it. If validation fails, I retry or return a clear error. This keeps the UI safe from malformed AI output.
2. The "Average Candidate" Trap: They say "AI generates questions" with no mention of prompt or validation.
3. The Top 1% Secret Sauce: I mention JSON format, parsing, and retry logic.

27. How do you validate AI output?

Keywords:

Structure check
Format validation
Retry logic

Answer:
1. The Live Script (The 1% Answer): I check that each question has exactly four options, a correct answer that matches one option, and a non-empty explanation. I also de-duplicate questions and sanitize text. If the output fails validation, I either retry once or return a user-friendly error. This prevents hallucinated or broken data from showing in the quiz. I learned this after seeing empty options appear in early tests.
2. The "Average Candidate" Trap: They say "I validate the output" without detailing rules.
3. The Top 1% Secret Sauce: I list exact validation rules and mention a real empty-option bug.

28. What if AI returns wrong data?

Keywords:

Validation
Fallback
Retry

Answer:
1. The Live Script (The 1% Answer): If AI returns wrong data, the validation layer rejects it. I then retry with a stricter prompt or return an error telling the user to try again. For some endpoints, I can fall back to cached content if available. The key is to fail fast and avoid showing broken content. This keeps user trust intact.
2. The "Average Candidate" Trap: They say "AI is not perfect" without a concrete handling strategy.
3. The Top 1% Secret Sauce: I explain reject, retry, and cache fallback in that order.

29. What if AI service is down?

Keywords:

Timeout
Fallback model
Cached data

Answer:
1. The Live Script (The 1% Answer): I use request timeouts so the server does not hang. If the AI provider is down, I return a clear error with a retry suggestion. For production, I would add a fallback model or cache previously generated questions for popular topics. The system should degrade gracefully rather than failing silently.
2. The "Average Candidate" Trap: They say "try again later" without mentioning timeouts or fallback.
3. The Top 1% Secret Sauce: I mention concrete timeout behavior and a real fallback plan.

30. How do you prevent prompt injection?

Answer:
1. The Live Script (The 1% Answer): I sanitize user input and wrap it inside strict prompt boundaries so it cannot override system instructions. I keep prompts as templates with fixed sections and only insert the minimal user input. Then I validate the output structure, which is a second layer of defense. If anything breaks the schema, it is rejected. This makes prompt injection less likely to affect downstream logic.
2. The "Average Candidate" Trap: They say "sanitize input" without explaining prompt boundaries or validation.
3. The Top 1% Secret Sauce: I explain fixed prompt templates and schema validation as defense in depth.



31. Why Multer?

Answer:
 I used Multer because it is the standard Express middleware for handling multipart form uploads. It lets me set file size limits, restrict file types, and store files temporarily for parsing. That protects the server and keeps the upload logic clean in the resume and document interview routes.
2. The "Average Candidate" Trap: They say "Multer is for uploads" without mentioning limits and validation.
3. The Top 1% Secret Sauce: I mention file type filtering and size limits as real guardrails.

32. How is PDF parsed?

Answer:
After upload, I pass the PDF buffer into pdf-parse to extract raw text. That text becomes the input to the AI profile parser. I also handle parsing errors and return a clear message if the file is not readable. This keeps the resume flow reliable.


33. How is DOCX parsed?

Answer:
For DOCX files I use Mammoth, which converts DOCX content into plain text. It handles structured content better than naive parsing. Like PDF parsing, I validate file type and catch errors, so the user gets a readable failure message rather than a crash.



34. What if uploaded resume is image only?

Answer:
 If the resume is image-only, pdf-parse or Mammoth will return empty text. In that case I would detect low text output and ask the user to re-upload or use OCR. For production, I would integrate OCR like Tesseract or a document AI service and run it asynchronously to keep latency reasonable.



35. What if user uploads huge file?


Answer:
 Multer enforces a file size limit, and I reject files that are too large. I also validate file type before parsing to avoid unnecessary processing. If the file is oversized, the user gets a clear error message. This protects both memory and CPU usage on the server.



36. Why Helmet?

Answer:

 Helmet sets secure HTTP headers like CSP, X-Frame-Options, and X-Content-Type-Options. It reduces common attack surfaces with almost zero effort. I use it as a default security baseline for the API so I do not forget those headers.



37. Why Rate Limiting?

Answer:
 Rate limiting protects the API from brute-force login attempts and abuse of expensive AI endpoints. I set a stricter limit for auth routes and AI-heavy routes, while keeping a higher limit for normal usage. This prevents spikes from taking down the service and keeps response times stable.


38. What is CORS?


Answer:
 CORS controls which origins can access the API from a browser. I set an allowlist for my client URLs and allow localhost in development. If an origin is not allowed, the server blocks it. This prevents random sites from calling my API from a browser context.



39. What is XSS?

Answer:

 XSS is when an attacker injects scripts into content that gets rendered in a browser. If the app displays unsanitized user input, that script can run in another user's session. In this project, I avoid dangerously rendering raw HTML and rely on React escaping by default. If I ever need to render rich content, I would sanitize it first.



40. What is NoSQL Injection?


Answer:

 NoSQL injection happens when user input is directly used in a query object and attackers can inject operators. I prevent that by validating and sanitizing inputs and by never allowing raw query objects from the client. I also use Mongoose schemas and explicit field access, which reduces the risk of operator injection.



41. How would you optimize this project?

Answer:

 I would add Redis caching for leaderboard and daily challenge endpoints to reduce repeated reads. I would also audit indexes on user and leaderboard collections. Compression is already enabled, but I would add response caching headers and possibly CDN caching for static assets. For AI flows, I would move heavy generation into background jobs and store results for reuse. That would make the app faster and more resilient under load.



42. Where would Redis help?

Answer:
 Redis would help cache daily leaderboards and trending topics because those are read-heavy and change predictably. It could also store short-lived interview session state to allow faster recovery if the user refreshes. For AI generation, caching recent questions reduces repeated API calls and cost. Redis also enables rate limiting at scale if I move beyond in-memory limits.



45. How would you support 1 million users?


Answer:
 I would keep the API stateless and scale horizontally behind a load balancer. Redis would handle sessions, caching, and distributed rate limiting. MongoDB would be tuned with indexes and possibly sharded if needed. AI calls would move to async worker queues with controlled concurrency. I would also use a CDN for the React app and static assets to reduce server load.



46. How would you make leaderboard real-time?

Answer:
1. The Live Script (The 1% Answer): I would add WebSockets or Socket.IO to push leaderboard updates to connected clients. On each new score, the server would emit a leaderboard update event. The client would update state without polling. For scale, I would use a Redis pub/sub adapter so multiple server instances can broadcast consistently.



47. How would you deploy globally?

Answer:
1. The Live Script (The 1% Answer): I would serve the React app through a CDN for fast global delivery. The API would be deployed in multiple regions with a global load balancer that routes users to the nearest region. MongoDB would need regional replication or a globally distributed cluster depending on consistency needs. AI endpoints might stay centralized to control cost, but I would use caching to reduce latency for common requests.
2. The "Average Candidate" Trap: They say "use CDN" without mentioning API or database distribution.
3. The Top 1% Secret Sauce: I discuss regional API and database replication trade-offs.

48. User refreshes during interview?

Keywords:

Auto save
Session recovery

Answer:
1. The Live Script (The 1% Answer): I persist interview state on the server with a session id, so when the user refreshes I can reload the session. On the client, I would also store the current question index in local storage so recovery is smoother. The server can return the latest question and previous answers for continuity. This is a common edge case in real interviews, so it needs explicit support.
2. The "Average Candidate" Trap: They say "it restarts" without offering recovery.
3. The Top 1% Secret Sauce: I mention session id persistence plus local storage recovery.



49. Internet disconnects during answer?


Answer:
1. The Live Script (The 1% Answer): I would store the draft answer in local storage and retry submission when connectivity returns. The client can show a reconnect banner and disable the submit button until the network is back. On the server, the session is still open so the answer can be accepted later. This avoids losing work mid-interview.
2. The "Average Candidate" Trap: They say "user retries" with no offline handling.
3. The Top 1% Secret Sauce: I mention local storage drafts and UI behavior during reconnect.





53. 10,000 users start interview together?

Answer:
 I would scale the API horizontally behind a load balancer and enforce stricter rate limits on AI endpoints. AI generation would be queued so only a controlled number run concurrently. I would also cache common prompts and use a CDN for static assets to reduce load. This keeps the system stable even under spikes.


54. Hardest challenge?

Answer:
The hardest challenge was keeping AI output reliable enough for real users. Early on, the model would return malformed MCQs or inconsistent answer keys, which broke the quiz UI. I added strict schema validation, de-duplication, and clear retry behavior. The result was a much more stable experience with fewer user-facing errors and more trust in the content.



56. What would you improve today?

Answer:
 I would add Redis for caching leaderboards and session recovery, and I would move AI tasks into a worker queue. I would also add proper monitoring with metrics and traces so I can see where latency spikes. Microservices are not needed yet, but I would separate the AI processing service if traffic grows. Those changes would make the system more resilient and cheaper to run.




59. What feature are you most proud of?

Answer:
 I am most proud of the AI validation and scoring pipeline in the quiz flow. It seems small, but it is what makes the app trustworthy. I had to design strict question schemas, filter duplicates, and compute scores that reflect both accuracy and speed. The impact is a cleaner UX and more meaningful feedback. It is technical depth that directly improves user trust.


60. Which part would break first in production?

Answer:
 The first stress point would be AI dependency: both latency and cost scale with usage. If usage spikes, AI calls would slow or become expensive. That is why I already have rate limits and timeouts, and why the next step would be caching and async queues. The database is more predictable to scale than AI cost and latency.
