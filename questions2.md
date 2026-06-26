Q1. Give me a 2-minute overview of this project.

Answer:
1. The Live Script (The 1% Answer): I built an AI interview-prep platform because I saw a gap between MCQ practice and real interview readiness. The core problem is that people can pick correct answers but struggle to explain and defend them in real interviews. My solution combines four flows in one product: AI-generated quizzes, live open-ended interview Q and A, resume-based interviews, and document-based mock interviews. On the frontend, I use React with route-level pages for each flow and a centralized Axios client for API calls and auth handling. The backend is Express with MongoDB, and I keep AI calls in a service layer so route logic stays clean. The flow is: generate content, validate it, store a session, then evaluate answers and update user stats. I also track accuracy, speed, and confidence to give realistic feedback. One bug I hit early was malformed AI question options, so I added strict validation and hard-fail behavior instead of showing broken content. The impact is a more realistic and measurable interview-prep experience than a static quiz app.
2. The "Average Candidate" Trap: They say "I built a quiz app using React and Node" and stop, with no real data flow or evaluation detail.
3. The Top 1% Secret Sauce: I mention validation, session storage, multi-metric scoring, and a real AI output bug fix.

Q2. What exact problem were you trying to solve?

Answer:
1. The Live Script (The 1% Answer): I was trying to solve the gap between practice and performance. Most platforms either give MCQs without real interview pressure or provide mock interviews without structured analytics. That means candidates do not know whether they are improving in communication, speed, or depth. My solution was to combine objective scoring from quizzes with AI-based evaluation for open-ended answers, and then track growth over time. I also added gamification like leaderboards and daily challenges so users actually practice consistently. A small but real problem I discovered was that users would abandon sessions when questions felt inconsistent, so I invested in output validation and clean error handling. That made the product feel trustworthy and kept engagement higher.
2. The "Average Candidate" Trap: They say "I wanted to learn full stack" without showing user pain or product reasoning.
3. The Top 1% Secret Sauce: I connect user pain to evaluation and retention, and I describe a concrete reliability fix.

Q3. Why did you choose React instead of Angular or Vue?

Answer:
1. The Live Script (The 1% Answer): I chose React because the app is a highly interactive SPA with repeated UI patterns, and React makes component reuse very efficient. React Router gives me smooth client-side navigation, which is important for interview flows because I do not want reloads to reset state. The ecosystem also made it easy to add animations and icons quickly. Angular felt heavier for the size of the project, and Vue would have been fine, but I already had the fastest delivery path with React. The trade-off is I have to manage performance in re-render-heavy screens like the quiz timer, so I isolated state and memoized where it mattered.
2. The "Average Candidate" Trap: They say "React is popular" without a product-specific reason or trade-off.
3. The Top 1% Secret Sauce: I tie React to SPA flow requirements and mention a real re-render hotspot and fix.

Q4. Why Node.js and Express?

Answer:
1. The Live Script (The 1% Answer): The backend is I/O heavy: file uploads, database reads, and AI API calls. Node is strong for that non-blocking workload and keeps the stack in one language end to end. Express also lets me compose middleware for auth, rate limiting, and request timeouts quickly. That helped me build fast and keep routes clean. A tricky part was AI latency; I added timeouts and endpoint-specific rate limits so slow AI calls do not block the whole server. That is easier to manage in Express with middleware.
2. The "Average Candidate" Trap: They say "Node is fast" without mentioning I/O patterns or middleware control.
3. The Top 1% Secret Sauce: I connect Node to AI latency and mention specific middleware defenses.

Q5. Why MongoDB instead of MySQL?

Answer:
1. The Live Script (The 1% Answer): MongoDB fit this project because quiz and interview sessions are nested and evolve as features grow. A session can store questions, answers, timing, and AI feedback in one document. That is a natural fit for a document store. I keep a User collection for aggregate stats and separate session collections for heavy data, which helps performance. MySQL could work, but it would require more joins and migrations as the schema changes. The trade-off with MongoDB is you must control document growth, so I store long histories in separate collections and index the common query fields.
2. The "Average Candidate" Trap: They say "MongoDB is flexible" without explaining the actual data shape.
3. The Top 1% Secret Sauce: I describe nested session payloads and the document growth trade-off.

Q6. Which feature of this project are you most proud of?

Answer:
1. The Live Script (The 1% Answer): I am most proud of the AI validation and scoring pipeline in quiz mode. It looks small, but it is the difference between a demo and a usable product. The AI sometimes returned malformed options or duplicated questions, which broke the UI. I added strict schema validation, de-duplication, and a clear fail-fast response if the content is unsafe. Then I compute accuracy, speed, and confidence to produce a final score that mirrors interview pressure. The result is a clean experience and feedback that users trust. It also made debugging much easier because errors are explicit instead of random UI failures.
2. The "Average Candidate" Trap: They say "the UI" or "the AI" without describing the actual engineering problem.
3. The Top 1% Secret Sauce: I reference a real failure mode and the exact validation and scoring steps I built.

Q7. Draw the complete architecture of your application.

Answer:
1. The Live Script (The 1% Answer): At a high level, the browser runs a React SPA. React pages call a centralized Axios client for API requests. The API is an Express server with middleware for security, rate limiting, and auth. Each route module handles one domain: auth, quiz, interview, resume, document, leaderboard, reviews, admin. AI calls live in a service layer so controllers stay focused on validation and persistence. MongoDB stores user profiles, quiz sessions, interview sessions, leaderboards, and daily challenges. The flow is: UI event -> Axios request -> middleware -> route handler -> AI or DB -> validation -> save -> response back to UI. I initially had AI logic inside routes, but splitting it into a service made testing and error handling much clearer.
2. The "Average Candidate" Trap: They list the stack but do not explain data flow or boundaries.
3. The Top 1% Secret Sauce: I mention middleware flow and the AI service separation as a real refactor decision.

Q8. Explain the entire request flow when a user starts a quiz.

Answer:
1. The Live Script (The 1% Answer): The user sets topic, difficulty, and question count in the quiz setup screen. The client sends a POST to /quiz/generate. The server validates input, optionally expands subtopics, and calls the AI service to generate questions. The AI response is parsed into JSON and validated: exactly four options, a valid correct key, and no duplicates. If validation fails, I return a clean error instead of broken content. When valid, I create a QuizSession with a sessionId and send the questions to the client. The client renders the quiz, collects answers and timing data, and submits to /quiz/submit. The server computes accuracy and speed, stores the completed session, and updates user stats and leaderboard.
2. The "Average Candidate" Trap: They say "AI generates questions and we show them" without validation or persistence steps.
3. The Top 1% Secret Sauce: I describe the validation rules, session storage, and scoring pipeline.

Q9. Why did you centralize Axios configuration?

Answer:
1. The Live Script (The 1% Answer): Centralizing Axios lets me inject JWT tokens into every request and handle errors consistently. I use interceptors to attach the Authorization header and to catch 401s so I can clear auth and redirect to login. It also gives me one place to set timeouts, which matters because resume parsing and AI calls can be slow. Without centralization, every page would reinvent this logic and bugs would creep in.
2. The "Average Candidate" Trap: They say "reusability" without mentioning auth or interceptors.
3. The Top 1% Secret Sauce: I reference concrete interceptor behavior and timeout customization.

Q10. What would happen if Axios was configured separately in every page?

Answer:
1. The Live Script (The 1% Answer): You would get duplicated logic and inconsistent behavior. One page might forget to attach the token, another might not handle 401s, and timeouts could differ across features. That leads to bugs that only show up in specific flows. Centralizing Axios gives a single source of truth for auth headers, error handling, and request defaults, which is especially important in an app with many routes.
2. The "Average Candidate" Trap: They say "more code" but do not explain the real failure modes.
3. The Top 1% Secret Sauce: I mention token omission and inconsistent 401 behavior as real bugs.

Q11. Explain your folder structure decisions.

Answer:
1. The Live Script (The 1% Answer): On the frontend, I separate pages, components, context providers, and services. Pages map to routes, components are reusable UI, context manages auth and toasts, and services hold API calls. On the backend, I separate routes, models, services, and utils. Routes define HTTP contracts, services handle AI integration, models define schemas, and utils cover deterministic logic like scoring and validation. This structure keeps responsibilities clean, makes it easier to test, and keeps the codebase scalable as new interview modes are added.
2. The "Average Candidate" Trap: They say "for cleanliness" without describing what goes where.
3. The Top 1% Secret Sauce: I map folder boundaries to responsibilities and mention how it scales for new modes.

Q12. Explain JWT authentication from login to protected route.

Answer:
1. The Live Script (The 1% Answer): On login, the server validates the password and signs a JWT containing the user id and expiry. The client stores that token and includes it in the Authorization header on every request. The backend has auth middleware that verifies the token signature and expiry, then attaches the user id to the request. Protected routes check that id before continuing. If verification fails, the request ends with a 401. This flow keeps the API stateless and easy to scale.
2. The "Average Candidate" Trap: They say "JWT is used" without explaining the full request path.
3. The Top 1% Secret Sauce: I mention token signing, header usage, middleware verification, and request attachment.

Q13. Why use JWT instead of sessions?

Answer:
1. The Live Script (The 1% Answer): JWT keeps the server stateless, which makes horizontal scaling easier and avoids shared session storage. With sessions, I would need Redis and session invalidation logic. JWT also works well in serverless environments. The trade-off is revocation is harder, so I use short expiries and plan for refresh token rotation if needed.
2. The "Average Candidate" Trap: They say "JWT is better" without the trade-offs.
3. The Top 1% Secret Sauce: I mention session store complexity and token revocation risk.

Q14. What information do you store inside JWT?

Answer:
1. The Live Script (The 1% Answer): I keep JWT payloads minimal: user id, optional role, and expiry timestamp. I avoid sensitive data because JWTs can be decoded by anyone holding them. The signature ensures the payload cannot be modified without detection. The server uses the user id to fetch user data or enforce role-based access.
2. The "Average Candidate" Trap: They say "user info" without mentioning expiry or minimal payload.
3. The Top 1% Secret Sauce: I mention the security reason for minimal payloads and signature verification.

Q15. What happens if the JWT expires during an interview session?

Answer:
1. The Live Script (The 1% Answer): If the token expires, the API returns 401. The Axios interceptor clears auth state and redirects to login. The interview session data is stored in MongoDB, so after re-login the user can resume or restart depending on the flow. For a production system, I would add refresh tokens to avoid interrupting long interviews.
2. The "Average Candidate" Trap: They say "user logs in again" without client behavior or data recovery.
3. The Top 1% Secret Sauce: I explain the interceptor behavior and session persistence in the database.

Q16. How can JWT be stolen?

Answer:
1. The Live Script (The 1% Answer): JWTs can be stolen through XSS if tokens are stored in local storage, via insecure network traffic if HTTPS is not enforced, or through compromised browser extensions. They can also be leaked by logging or exposing them in URLs. That is why storage and transport choices matter.
2. The "Average Candidate" Trap: They say "JWT can be hacked" without actual threat vectors.
3. The Top 1% Secret Sauce: I list concrete attack paths like XSS, transport, and logging leaks.

Q17. How would you prevent token theft?

Answer:
1. The Live Script (The 1% Answer): I would store tokens in secure, httpOnly cookies to reduce XSS risk, enforce HTTPS, and use short expiries with refresh token rotation. I would also set proper CSP headers, avoid rendering unsanitized HTML, and avoid logging tokens. For this project, tokens are in local storage for simplicity, but the production path would be cookie-based.
2. The "Average Candidate" Trap: They say "use HTTPS" without mentioning storage or CSP.
3. The Top 1% Secret Sauce: I describe httpOnly cookies, CSP, and refresh rotation as concrete defenses.

Q18. If an attacker modifies the JWT payload manually, what happens?

Answer:
1. The Live Script (The 1% Answer): The token signature will fail verification because the payload no longer matches the signed hash. The server rejects it and returns 401. That is the point of signing: anyone can read the payload, but only the server can generate a valid signature.
2. The "Average Candidate" Trap: They say "it will not work" without explaining signatures.
3. The Top 1% Secret Sauce: I mention signature mismatch and why JWT payloads are readable but not forgeable.

Q19. Explain all collections in MongoDB.

Answer:
1. The Live Script (The 1% Answer): User holds identity plus aggregate stats and gamification data. QuizSession stores each quiz attempt, including questions, answers, timing, and scores. ResumeInterview and DocumentInterview store session data plus AI evaluation feedback and summaries. LeaderboardEntry stores score snapshots by date and topic for ranking. DailyChallenge stores a generated daily set of questions. Review stores feedback or testimonials. This keeps heavy session data out of the User document and makes read patterns predictable.
2. The "Average Candidate" Trap: They list collections without describing their responsibility boundaries.
3. The Top 1% Secret Sauce: I explain why User is aggregate and sessions are separate.

Q20. Why separate QuizSession from User?

Answer:
1. The Live Script (The 1% Answer): QuizSession documents are large and numerous, while User is read frequently. If I embed every quiz history inside User, the document grows and performance suffers. Separating keeps User lightweight and allows efficient queries on sessions. It also avoids the MongoDB document size limit and makes indexing easier.
2. The "Average Candidate" Trap: They say "for organization" without performance or size reasons.
3. The Top 1% Secret Sauce: I mention document growth and the 16MB limit risk.

Q21. Show relationships between all collections.

Answer:
1. The Live Script (The 1% Answer): User is the root identity. QuizSession, ResumeInterview, and DocumentInterview reference userId. LeaderboardEntry references userName or userId plus topic and date. DailyChallenge stands alone by date but is linked by usage. Review references user info for display. Relationships are mostly one-to-many from User to sessions, which fits MongoDB well.
2. The "Average Candidate" Trap: They say "they are linked" without specifying how.
3. The Top 1% Secret Sauce: I describe one-to-many and the exact link keys.

Q22. Which fields should be indexed?

Answer:
1. The Live Script (The 1% Answer): Email should be unique indexed for login. userId should be indexed on QuizSession and interview collections for fast history fetches. LeaderboardEntry should be indexed by date and topic for daily and topic queries. createdAt indexes help admin analytics. I would also index sessionId for fast resume and document session lookup.
2. The "Average Candidate" Trap: They say "frequent fields" without naming any.
3. The Top 1% Secret Sauce: I list concrete fields tied to actual query patterns.

Q23. What query is most expensive in your system?

Answer:
1. The Live Script (The 1% Answer): Leaderboard aggregation is the most expensive because it scans many entries and sorts by score within a date range. Interview history queries can also be heavy if a user has many sessions. To optimize, I index date and topic on leaderboard, and I paginate or limit history queries on sessions. If traffic grows, I would add caching for leaderboard results.
2. The "Average Candidate" Trap: They say "database queries" without naming the specific workload.
3. The Top 1% Secret Sauce: I identify leaderboard sorting as the hot path and tie it to indexing and caching.

Q24. What happens if your leaderboard collection reaches 100 million records?

Answer:
1. The Live Script (The 1% Answer): I would partition by date, archive old records, and build daily summary tables. I would also store precomputed leaderboards for popular ranges and serve them from cache. If needed, I would shard the collection by date or topic to distribute load. The key is to avoid scanning the entire collection for every request.
2. The "Average Candidate" Trap: They say "add more servers" without data strategy.
3. The Top 1% Secret Sauce: I mention partitioning, archiving, and precomputed leaderboards.

Q25. Why not store all quiz history inside User document?

Answer:
1. The Live Script (The 1% Answer): Storing all history in User grows the document quickly and makes every user read heavier. It risks the 16MB document limit and slows down auth and profile fetches. Separate QuizSession documents keep User small and allow efficient pagination of history. It also makes it easier to index and query by topic or date.
2. The "Average Candidate" Trap: They say "not clean" without size or performance reasoning.
3. The Top 1% Secret Sauce: I mention the document size limit and read performance impact.

Q26. Explain exactly how AI-generated questions are created.

Answer:
1. The Live Script (The 1% Answer): The server builds a prompt with topic, difficulty, and count and asks the AI to return JSON. The response includes question text, four options, correct answer, and an explanation. I parse it, validate structure, filter duplicates, and only then store it as a session. If it fails validation, I retry or return a clear error. This keeps the UI safe from malformed output.
2. The "Average Candidate" Trap: They say "AI generates questions" without describing prompt and validation.
3. The Top 1% Secret Sauce: I mention JSON structure and the validation pipeline.

Q27. What if the AI returns invalid JSON?

Answer:
1. The Live Script (The 1% Answer): I catch JSON parse errors and treat the output as invalid. I either retry with a stricter prompt or return a user-friendly error that suggests retrying. I do not send partial content to the client. This prevents broken UI states and keeps user trust.
2. The "Average Candidate" Trap: They say "try again" without handling parsing errors.
3. The Top 1% Secret Sauce: I mention JSON parsing failures and strict rejection.

Q28. How do you validate AI output?

Answer:
1. The Live Script (The 1% Answer): I check that each question has exactly four options, a correct answer that matches one option, and a non-empty explanation. I also de-duplicate questions and sanitize text. If validation fails, I retry once or fail with a clear error. This came from real issues where the AI returned empty options or mismatched correct keys.
2. The "Average Candidate" Trap: They say "validate output" without concrete rules.
3. The Top 1% Secret Sauce: I list specific validation rules and a real failure mode.

Q29. What if AI generates duplicate questions?

Answer:
1. The Live Script (The 1% Answer): I normalize question text and run a duplicate check before saving. If duplicates exist, I remove them or retry generation to fill the count. This prevents a user from seeing the same question twice and improves quality. I discovered this after testing topics with small question pools.
2. The "Average Candidate" Trap: They say "it will not happen" or ignore it.
3. The Top 1% Secret Sauce: I mention normalization and duplicate filtering with a real trigger.

Q30. What if AI becomes unavailable?

Answer:
1. The Live Script (The 1% Answer): I use request timeouts so the server does not hang. If the AI is down, I return a clear error and suggest retrying. For production, I would keep a fallback provider or cached question sets for popular topics so the system degrades gracefully.
2. The "Average Candidate" Trap: They say "try later" without timeouts or fallback.
3. The Top 1% Secret Sauce: I mention timeouts plus fallback cache or provider.

Q31. How would you implement AI fallback providers?

Answer:
1. The Live Script (The 1% Answer): I would abstract the AI calls behind a provider interface and configure a priority list. If the primary fails or times out, I would switch to a secondary provider. I would log failures and rate-limit fallback usage to control cost. This keeps the route logic unchanged while making the AI layer resilient.
2. The "Average Candidate" Trap: They say "use another API" without architecture details.
3. The Top 1% Secret Sauce: I describe a provider interface and failover logic.

Q32. What if AI responds after 60 seconds?

Answer:
1. The Live Script (The 1% Answer): The API has a timeout to avoid hanging requests. For long tasks, I would move them into a background queue and return a job id so the client can poll or get a callback. That keeps the UI responsive and avoids tying up server resources.
2. The "Average Candidate" Trap: They say "increase timeout" without re-architecting.
3. The Top 1% Secret Sauce: I mention async jobs and job ids as the scalable fix.

Q33. Can users manipulate prompts to get easier questions?

Answer:
1. The Live Script (The 1% Answer): It is possible if user input is injected directly into prompts without control. That is why I keep prompts as templates with fixed instructions and only insert minimal user input like topic and difficulty. I also validate outputs so even if a prompt is manipulated, the content still has to match schema. That reduces the risk of prompt exploitation.
2. The "Average Candidate" Trap: They say "users cannot" without any protection strategy.
3. The Top 1% Secret Sauce: I mention prompt templates and schema validation as layered defense.

Q34. How would you prevent prompt injection?

Answer:
1. The Live Script (The 1% Answer): I sanitize user input, strip dangerous tokens, and wrap input inside strict boundaries in the prompt. The system instructions are fixed and never influenced by user text. Then I validate the output structure and reject anything that deviates. This defense in depth makes injection attempts much less effective.
2. The "Average Candidate" Trap: They say "sanitize" without mentioning prompt boundaries or output validation.
3. The Top 1% Secret Sauce: I emphasize fixed prompt templates plus schema validation.

Q35. Explain the complete resume upload pipeline.

Answer:
1. The Live Script (The 1% Answer): The user uploads a PDF or DOCX through a multipart request to /resume-interview/upload. Multer validates file type and size, then I extract text using pdf-parse or Mammoth. That text is sent to the AI service to produce a structured profile like skills, experience, and projects. I generate questions based on that profile and evaluate each answer. The session stores per-question feedback and a final summary. I also log basic anti-cheat events like tab switches. The tricky part was handling messy PDFs, so I added clear error messaging and asked users to re-upload if extraction was weak.
2. The "Average Candidate" Trap: They say "upload and AI asks questions" without parsing details.
3. The Top 1% Secret Sauce: I mention multer, pdf-parse, Mammoth, and real-world extraction issues.

Q36. Why use Multer?

Answer:
1. The Live Script (The 1% Answer): Multer is the standard Express middleware for multipart uploads. It gives me file size limits, file type filtering, and controlled storage. That helps protect the server and keeps the upload logic clean and consistent.
2. The "Average Candidate" Trap: They say "for uploads" without mentioning limits or filtering.
3. The Top 1% Secret Sauce: I mention size limits and type filtering as real protections.

Q37. How do PDF and DOCX parsing differ?

Answer:
1. The Live Script (The 1% Answer): PDFs are parsed with pdf-parse, which extracts text from the PDF layout and is sensitive to formatting. DOCX is parsed with Mammoth, which converts structured document content into clean text. PDF extraction can be noisy if the document is scanned or has complex layout, while DOCX is usually cleaner. I handle both and return clear errors when extraction fails.
2. The "Average Candidate" Trap: They say "different formats" without any practical difference.
3. The Top 1% Secret Sauce: I mention library choice and format-specific extraction quality.

Q38. What happens if a resume is image-based?

Answer:
1. The Live Script (The 1% Answer): Image-based resumes yield little or no text when parsed. I detect low text output and tell the user to re-upload a text-based file. For production, I would integrate OCR like Tesseract or a document AI service and run it asynchronously to keep latency reasonable.
2. The "Average Candidate" Trap: They say "use OCR" without detection or async plan.
3. The Top 1% Secret Sauce: I mention low-text detection and async OCR.

Q39. What if a user uploads a 500 MB file?

Answer:
1. The Live Script (The 1% Answer): Multer enforces strict file size limits, so the upload is rejected before parsing. I return a clear error message so the user can retry with a smaller file. This protects memory and CPU and prevents denial of service by large files.
2. The "Average Candidate" Trap: They say "we reject big files" without stating where or why.
3. The Top 1% Secret Sauce: I mention Multer limit enforcement and resource protection.

Q40. How would you restrict uploads securely?

Answer:
1. The Live Script (The 1% Answer): I validate MIME type and file extension, enforce size limits, and store uploads in a temporary directory that is not publicly served. I also sanitize file names and delete files after parsing. This reduces the risk of malicious content being stored or executed.
2. The "Average Candidate" Trap: They say "validate inputs" without concrete file safeguards.
3. The Top 1% Secret Sauce: I mention MIME checks, temp storage, and cleanup.

Q41. How do you prevent malicious file uploads?

Answer:
1. The Live Script (The 1% Answer): I restrict file types, enforce size limits, and parse only the content I need. I do not execute or render uploaded files on the server. I also keep uploads outside the public folder and delete them after processing. For production, I would scan files with a malware service if uploads are frequent.
2. The "Average Candidate" Trap: They say "use validation" without describing how to isolate files.
3. The Top 1% Secret Sauce: I mention non-public storage and delete-after-parse behavior.

Q42. How does the system extract questions from documents?

Answer:
1. The Live Script (The 1% Answer): After upload, I extract raw text and then parse it into question and answer pairs using simple formatting rules. If a clear answer key is present, I store it. If not, I ask the AI to generate ideal answers for evaluation. This lets the same pipeline handle both structured and semi-structured documents.
2. The "Average Candidate" Trap: They say "AI reads the document" without parsing logic.
3. The Top 1% Secret Sauce: I mention explicit Q/A parsing and AI fallback for missing keys.

Q43. What if formatting is inconsistent?

Answer:
1. The Live Script (The 1% Answer): Inconsistent formatting can break simple parsing, so I add normalization and fallback rules. If parsing fails, I ask the AI to normalize the content into a consistent Q/A structure. I also log these cases so I can improve the parser over time. This keeps the feature usable even with messy documents.
2. The "Average Candidate" Trap: They say "we handle it" without a real strategy.
3. The Top 1% Secret Sauce: I mention normalization plus AI-assisted restructuring.

Q44. What if answer keys are missing?

Answer:
1. The Live Script (The 1% Answer): If the document lacks answers, I generate ideal answers using the AI based on the question text. I store those as references and evaluate user responses against them. I also label them as AI-generated so users understand the source. This keeps the flow working even without a provided key.
2. The "Average Candidate" Trap: They say "AI will answer" without describing storage or transparency.
3. The Top 1% Secret Sauce: I mention storing AI-generated references and labeling them.

Q45. How do you measure answer quality?

Answer:
1. The Live Script (The 1% Answer): For open-ended answers, I evaluate coverage and clarity against an ideal answer or expected concepts. The AI returns a score and feedback, and I store that alongside the response. I also enforce a minimum answer length based on difficulty to avoid one-word answers. This produces consistent evaluations and encourages proper explanations.
2. The "Average Candidate" Trap: They say "AI gives a score" with no explanation of criteria.
3. The Top 1% Secret Sauce: I mention expected concept coverage and minimum length enforcement.

Q46. What if AI gives an incorrect evaluation?

Answer:
1. The Live Script (The 1% Answer): AI evaluations are not perfect, so I treat them as guidance, not absolute truth. If feedback looks off, I allow retries and show explanations so users can judge. For production, I would add human-in-the-loop review for edge cases and calibrate prompts with gold data. I also store evaluations so they can be audited later.
2. The "Average Candidate" Trap: They claim AI is always correct.
3. The Top 1% Secret Sauce: I acknowledge imperfection and mention auditability and calibration.

Q47. Explain React component lifecycle.

Answer:
1. The Live Script (The 1% Answer): A React component mounts, renders, updates when state or props change, and unmounts when removed. In function components, useEffect covers side effects and cleanup. For example, in my quiz screen I start a timer in useEffect and clear it on unmount. This prevents memory leaks and stale updates.
2. The "Average Candidate" Trap: They say "mount and unmount" without real usage.
3. The Top 1% Secret Sauce: I connect lifecycle to a timer and cleanup in the quiz screen.

Q48. Why use SPA architecture?

Answer:
1. The Live Script (The 1% Answer): SPA keeps transitions smooth and avoids full page reloads, which is important for interview sessions. It also lets me reuse state across pages, like auth and theme. With React Router, I can still have clean URLs for each flow. This improves UX and keeps the app fast.
2. The "Average Candidate" Trap: They say "SPA is faster" without tying to user flows.
3. The Top 1% Secret Sauce: I mention interview flow continuity and shared state.

Q49. What happens during route changes?

Answer:
1. The Live Script (The 1% Answer): React Router updates the URL and renders the matching component without a full page reload. It can preserve app state like auth and theme. In my app I also use animation transitions between routes, which run as the component mounts and unmounts. This creates a smooth experience without losing state.
2. The "Average Candidate" Trap: They say "route changes show a new page" without explaining client-side rendering.
3. The Top 1% Secret Sauce: I mention state preservation and animated transitions.

Q50. How do you avoid unnecessary re-renders?

Answer:
1. The Live Script (The 1% Answer): I keep state local, memoize heavy computations, and avoid passing new function references to child components unless needed. For pure components, React.memo helps prevent re-renders when props are unchanged. In the quiz flow, I separated the timer state from the question list so ticking does not re-render everything. That kept the UI smooth.
2. The "Average Candidate" Trap: They list useMemo and useCallback without saying where.
3. The Top 1% Secret Sauce: I mention isolating timer state as a concrete performance fix.