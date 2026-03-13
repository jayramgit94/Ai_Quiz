const axios = require("axios");
const { compareAnswers } = require("../utils/documentInterview");

// Sanitize control characters that break JSON.parse
function sanitizeJsonString(str) {
  return str.replace(/[\x00-\x1F\x7F]/g, (ch) => {
    if (ch === "\n" || ch === "\r" || ch === "\t") return ch;
    return "";
  });
}

const API_KEY = process.env.GROK_API_KEY;

// Auto-detect: Groq keys start with "gsk_", Grok/x.ai keys start with "xai-"
function getApiConfig() {
  if (!API_KEY || API_KEY === "your_grok_api_key_here") {
    throw new Error("GROK_API_KEY is not configured. Set it in server/.env");
  }

  if (API_KEY.startsWith("gsk_")) {
    // Groq API
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile",
      key: API_KEY,
    };
  }
  // Default: Grok / x.ai API
  return {
    url: "https://api.x.ai/v1/chat/completions",
    model: "grok-3-mini-fast",
    key: API_KEY,
  };
}

/**
 * Call AI API (supports both Grok and Groq)
 */
async function callGrok(messages, maxTokens = 4096) {
  const config = getApiConfig();

  const response = await axios.post(
    config.url,
    {
      model: config.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      timeout: 120000,
    },
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI returned empty response");
  }
  return content;
}

/**
 * Generate quiz questions using Grok API
 */
async function generateQuizQuestions(topic, difficulty, count, subtopics = []) {
  const topicContext = subtopics.length
    ? `focusing on these subtopics: ${subtopics.join(", ")}`
    : "";

  const systemPrompt = `You are an expert technical interviewer and educational content creator.
Generate high-quality multiple choice questions based on the given topic.

STRICT RULES:
1. Each question must have EXACTLY 4 options labeled A), B), C), D).
2. Only ONE option must be correct.
3. Avoid ambiguous wording.
4. Ensure the explanation clearly justifies the correct answer.
5. Questions must be technically accurate.
6. If uncertain about correctness, skip that question.
7. Avoid repeating concepts across questions.
8. Difficulty must match the requested level.
9. Each option must start with its letter: "A) ...", "B) ...", "C) ...", "D) ..."
10. correctAnswer must be ONLY the letter: "A", "B", "C", or "D"

QUESTION STYLE:
- Easy → definition based, straightforward recall
- Medium → conceptual understanding, comparing concepts
- Hard → scenario based, tricky edge cases, real-world problems

ADDITIONAL FIELDS:
- "example": A short practical example related to the question
- "interviewTip": A tip for how this concept appears in technical interviews

Return ONLY valid JSON, no markdown, no code blocks, no extra text.`;

  const userPrompt = `Generate exactly ${count} ${difficulty} difficulty multiple choice questions about "${topic}" ${topicContext}.

Return this EXACT JSON format:
{
  "questions": [
    {
      "question": "Clear, specific question text",
      "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
      "correctAnswer": "A",
      "explanation": "Clear explanation of why this is correct",
      "example": "A practical example illustrating this concept",
      "interviewTip": "How this might come up in interviews",
      "difficulty": "${difficulty}",
      "topic": "${topic}"
    }
  ]
}`;

  const raw = await callGrok([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  return parseQuizJSON(raw, count);
}

/**
 * Parse and validate quiz JSON from Grok response
 */
function parseQuizJSON(raw, expectedCount) {
  // Strip markdown code blocks if present
  let cleaned = sanitizeJsonString(raw.trim());
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Try to extract JSON from response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Failed to parse AI response as JSON");
    }
  }

  const questions = parsed.questions || parsed;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("No questions generated");
  }

  // Validate and clean each question
  const validated = questions
    .filter((q) => {
      if (!q.question || !q.options || !q.correctAnswer) return false;
      if (!Array.isArray(q.options) || q.options.length !== 4) return false;
      // Ensure correctAnswer letter matches one of the options
      const letter = q.correctAnswer.charAt(0).toUpperCase();
      if (!["A", "B", "C", "D"].includes(letter)) return false;
      // Ensure option with that letter exists
      const hasMatchingOption = q.options.some(
        (opt) => opt.charAt(0).toUpperCase() === letter,
      );
      if (!hasMatchingOption) return false;
      return true;
    })
    .map((q) => ({
      question: q.question,
      options: q.options.map((opt, i) => {
        const letters = ["A", "B", "C", "D"];
        // Ensure option starts with letter prefix
        if (!opt.match(/^[A-D]\)/)) {
          return `${letters[i]}) ${opt}`;
        }
        return opt;
      }),
      correctAnswer: q.correctAnswer.charAt(0).toUpperCase(),
      explanation: q.explanation || "No explanation available.",
      example: q.example || "",
      interviewTip: q.interviewTip || "",
      difficulty: q.difficulty || "medium",
      topic: q.topic || "",
    }));

  // Remove duplicate questions
  const seen = new Set();
  const unique = validated.filter((q) => {
    const key = q.question.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    throw new Error("All generated questions failed validation");
  }

  return unique.slice(0, expectedCount);
}

/**
 * Expand a keyword into subtopics using Grok
 */
async function expandTopic(keyword) {
  const prompt = `Given the technical topic "${keyword}", list 5-8 important subtopics that should be covered in a quiz.

Return ONLY a JSON array of strings, no markdown, no extra text.
Example: ["Subtopic 1", "Subtopic 2", "Subtopic 3"]`;

  const raw = await callGrok([{ role: "user", content: prompt }], 1024);

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    throw new Error("Not an array");
  } catch {
    // Try to extract array
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [keyword];
  }
}

/**
 * Generate interview question using Grok
 */
async function generateInterviewQuestion(
  topic,
  difficulty,
  questionNumber,
  previousContext = "",
) {
  const contextNote = previousContext
    ? `Previous context: ${previousContext}\nGenerate a follow-up question that builds on this context.`
    : `Generate the first interview question.`;

  const prompt = `You are conducting a technical interview about "${topic}" at ${difficulty} difficulty.
This is question #${questionNumber}.
${contextNote}

Generate ONE multiple choice question with 4 options.

Return ONLY valid JSON:
{
  "question": "Interview-style question text",
  "options": ["A) option", "B) option", "C) option", "D) option"],
  "correctAnswer": "A",
  "explanation": "Detailed explanation",
  "interviewTip": "How to answer this in a real interview"
}`;

  const raw = await callGrok([{ role: "user", content: prompt }], 2048);

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Failed to parse interview question");
  }

  // Validate
  if (!parsed.question || !parsed.options || parsed.options.length !== 4) {
    throw new Error("Invalid interview question format");
  }

  return {
    question: parsed.question,
    options: parsed.options.map((opt, i) => {
      const letters = ["A", "B", "C", "D"];
      if (!opt.match(/^[A-D]\)/)) return `${letters[i]}) ${opt}`;
      return opt;
    }),
    correctAnswer: (parsed.correctAnswer || "A").charAt(0).toUpperCase(),
    explanation: parsed.explanation || "",
    interviewTip: parsed.interviewTip || "",
  };
}

/**
 * Generate a live (open-ended) interview question.
 */
async function generateLiveInterviewQuestion(
  topic,
  difficulty,
  questionNumber,
  previousContext = "",
) {
  const contextNote = previousContext
    ? `Use this context to generate a meaningful follow-up question:\n${previousContext}`
    : "Generate the first open-ended interview question.";

  const prompt = `You are conducting a real technical interview.

Topic: ${topic}
Difficulty: ${difficulty}
Question number: ${questionNumber}
${contextNote}

Return ONLY valid JSON:
{
  "question": "One open-ended interview question",
  "expectedAnswer": "A concise high-quality reference answer in 3-6 lines",
  "expectedTopics": ["topic 1", "topic 2", "topic 3"],
  "interviewTip": "Practical guidance for answering this question"
}

Rules:
1) Do NOT return MCQ options.
2) Question must be answerable verbally.
3) Keep expectedTopics specific and technical.`;

  const raw = await callGrok([{ role: "user", content: prompt }], 1800);
  const parsed = parseJsonFromAi(raw);

  return {
    question: parsed.question || `Explain ${topic} in detail.`,
    expectedAnswer: parsed.expectedAnswer || "",
    expectedTopics: Array.isArray(parsed.expectedTopics)
      ? parsed.expectedTopics
      : [],
    interviewTip: parsed.interviewTip || "Structure your answer clearly.",
  };
}

function getStrictnessConfig(difficulty = "medium") {
  const level = String(difficulty || "medium").toLowerCase();
  if (level === "easy") {
    return { minWords: 1, blendWeight: 0.55 };
  }
  if (level === "hard") {
    return { minWords: 4, blendWeight: 0.8 };
  }
  return { minWords: 2, blendWeight: 0.68 };
}

function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Evaluate a live open-ended interview answer.
 */
async function evaluateLiveInterviewAnswer({
  topic,
  question,
  userAnswer,
  difficulty,
  questionNumber,
  expectedAnswer = "",
  expectedTopics = [],
}) {
  const safeAnswer = (userAnswer || "").trim();
  const strictness = getStrictnessConfig(difficulty);
  if (countWords(safeAnswer) < strictness.minWords) {
    return {
      score: 0,
      relevance: 0,
      depth: 0,
      communication: 0,
      semanticSimilarity: 0,
      referenceAnswer: "",
      matchedKeyTerms: [],
      missingKeyTerms: [],
      feedback:
        "No meaningful answer detected. Try giving a structured answer with key concepts and a short example.",
      guidance: [
        "Start with a direct definition or approach.",
        "Mention technical trade-offs.",
        "Close with a practical example.",
      ],
    };
  }

  const referenceGen = await generateDocumentIdealAnswer(question);
  const generatedReference = referenceGen.idealAnswer || "";
  const referenceAnswer =
    expectedAnswer && expectedAnswer.trim().length >= 10
      ? expectedAnswer.trim()
      : generatedReference;
  const similarity = compareAnswers(safeAnswer, referenceAnswer);

  const expectedTopicList = Array.isArray(expectedTopics)
    ? expectedTopics.filter(Boolean).map((t) => String(t).trim())
    : [];

  const loweredAnswer = safeAnswer.toLowerCase();
  const coveredTopics = expectedTopicList.filter((topicItem) =>
    loweredAnswer.includes(topicItem.toLowerCase()),
  );
  const topicCoverage = expectedTopicList.length
    ? Math.round((coveredTopics.length / expectedTopicList.length) * 100)
    : 0;

  const prompt = `You are evaluating a spoken interview response.

TOPIC: ${topic}
DIFFICULTY: ${difficulty}
QUESTION #${questionNumber}: ${question}

REFERENCE ANSWER:
${referenceAnswer}

EXPECTED TOPICS:
${expectedTopicList.join(", ") || "none"}

CANDIDATE ANSWER:
${safeAnswer}

DETERMINISTIC SIGNAL:
- Semantic similarity: ${similarity.semanticSimilarity}/100
- Missing key terms: ${similarity.missingKeyTerms.join(", ") || "none"}
- Topic coverage: ${topicCoverage}/100

Return ONLY valid JSON:
{
  "score": 0-100,
  "relevance": 0-100,
  "depth": 0-100,
  "communication": 0-100,
  "feedback": "short interview-style feedback paragraph",
  "guidance": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"]
}

Rules:
1) Do not hallucinate facts not present in candidate answer.
2) Keep feedback practical and encouraging.
3) Respect deterministic signal.`;

  let parsed;
  try {
    parsed = parseJsonFromAi(
      await callGrok([{ role: "user", content: prompt }], 1800),
    );
  } catch {
    parsed = {};
  }

  const signalScore = Math.round(
    similarity.semanticSimilarity * 0.75 + topicCoverage * 0.25,
  );
  const rawScore = Number(parsed.score || signalScore || 0);
  const blended = Math.round(
    rawScore * strictness.blendWeight +
      signalScore * (1 - strictness.blendWeight),
  );

  return {
    score: Math.min(100, Math.max(0, blended)),
    relevance: Math.min(100, Math.max(0, Number(parsed.relevance || blended))),
    depth: Math.min(
      100,
      Math.max(0, Number(parsed.depth || Math.max(blended - 5, 0))),
    ),
    communication: Math.min(
      100,
      Math.max(0, Number(parsed.communication || Math.max(blended - 3, 0))),
    ),
    semanticSimilarity: similarity.semanticSimilarity,
    topicCoverage,
    coveredTopics,
    referenceAnswer,
    matchedKeyTerms: similarity.matchedKeyTerms,
    missingKeyTerms: similarity.missingKeyTerms,
    feedback:
      parsed.feedback ||
      "Good attempt. Improve structure: answer directly, explain reasoning, and give a concrete example.",
    guidance: Array.isArray(parsed.guidance)
      ? parsed.guidance.slice(0, 4)
      : [
          "Answer with a 3-part structure: core concept, implementation, and example.",
          "Use precise technical vocabulary for the topic.",
          "Highlight trade-offs and edge cases where relevant.",
        ],
  };
}

/**
 * Evaluate interview answer using Grok
 */
async function evaluateInterviewAnswer(
  topic,
  question,
  userAnswer,
  questionNumber,
  options,
  correctAnswer,
) {
  // Deterministic evaluation — compare letters directly instead of asking AI to guess
  let evaluation = "incorrect";
  if (correctAnswer && userAnswer) {
    evaluation =
      userAnswer.toUpperCase().charAt(0) ===
      correctAnswer.toUpperCase().charAt(0)
        ? "correct"
        : "incorrect";
  }

  // Build context-rich prompt for feedback only (not for determining correct/incorrect)
  const optionsBlock = options && options.length ? options.join("\n") : "";
  const correctText = options
    ? (options.find((o) =>
        o.toUpperCase().startsWith(correctAnswer?.toUpperCase()?.charAt(0)),
      ) ?? correctAnswer)
    : (correctAnswer ?? userAnswer);
  const userText = options
    ? (options.find((o) =>
        o.toUpperCase().startsWith(userAnswer?.toUpperCase()?.charAt(0)),
      ) ?? userAnswer)
    : userAnswer;

  const prompt = `You are a technical interviewer providing educational feedback.

Topic: ${topic}
Question: ${question}
${optionsBlock ? `Options:\n${optionsBlock}\n` : ""}Correct Answer: ${correctText}
User Selected: ${userText}
Result: ${evaluation.toUpperCase()}

Write 2-3 sentences explaining why the correct answer is right and what the user should learn.
Then generate a follow-up question on the same topic.

Return ONLY valid JSON:
{
  "feedback": "Educational feedback explaining the correct answer",
  "followUpQuestion": {
    "question": "Follow-up question text",
    "options": ["A) option", "B) option", "C) option", "D) option"],
    "correctAnswer": "A",
    "explanation": "Explanation",
    "interviewTip": "Interview tip"
  },
  "questionNumber": ${questionNumber + 1}
}`;

  const raw = await callGrok([{ role: "user", content: prompt }], 2048);

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Failed to parse evaluation");
  }

  // Ensure follow-up question options are formatted correctly
  if (parsed.followUpQuestion?.options) {
    parsed.followUpQuestion.options = parsed.followUpQuestion.options.map(
      (opt, i) => {
        const letters = ["A", "B", "C", "D"];
        if (!opt.match(/^[A-D]\)/)) return `${letters[i]}) ${opt}`;
        return opt;
      },
    );
    parsed.followUpQuestion.correctAnswer = (
      parsed.followUpQuestion.correctAnswer || "A"
    )
      .charAt(0)
      .toUpperCase();
  }

  return {
    evaluation, // determined deterministically above, not from AI
    feedback: parsed.feedback || "No feedback available.",
    followUpQuestion: parsed.followUpQuestion || null,
    questionNumber: parsed.questionNumber || questionNumber + 1,
  };
}

/**
 * Parse resume text into structured data using AI
 */
async function parseResumeContent(rawText) {
  const prompt = `You are an expert resume parser. Analyze the following resume text and extract structured information.

RESUME TEXT:
"""
${rawText.substring(0, 6000)}
"""

Extract the following information and return ONLY valid JSON, no markdown, no code blocks:
{
  "name": "Full name",
  "email": "Email address or empty string",
  "phone": "Phone number or empty string",
  "skills": ["skill1", "skill2", ...],
  "technologies": ["tech1", "tech2", ...],
  "projects": [
    {
      "name": "Project name",
      "description": "Brief description",
      "technologies": ["tech used"]
    }
  ],
  "experience": [
    {
      "role": "Job title",
      "company": "Company name",
      "duration": "Duration",
      "highlights": ["Key achievement 1", "Key achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "institution": "Institution name",
      "year": "Year or year range"
    }
  ],
  "summary": "A 2-3 sentence professional summary based on the resume"
}

Be thorough - extract ALL skills, technologies, projects, and experience mentioned.
If a field is not found, use empty string for strings and empty arrays for arrays.`;

  const raw = await callGrok([{ role: "user", content: prompt }], 4096);

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Failed to parse resume content");
  }
}

/**
 * Generate interview questions based on parsed resume
 */
async function generateResumeQuestions(parsedResume, config = {}) {
  const {
    role = "Software Engineer",
    difficulty = "medium",
    totalQuestions = 8,
  } = config;

  const resumeContext = `
Name: ${parsedResume.name || "Candidate"}
Skills: ${(parsedResume.skills || []).join(", ")}
Technologies: ${(parsedResume.technologies || []).join(", ")}
Projects: ${(parsedResume.projects || []).map((p) => `${p.name}: ${p.description}`).join("; ")}
Experience: ${(parsedResume.experience || []).map((e) => `${e.role} at ${e.company}`).join("; ")}
Education: ${(parsedResume.education || []).map((e) => `${e.degree} from ${e.institution}`).join("; ")}
Summary: ${parsedResume.summary || "N/A"}`;

  const prompt = `You are a senior technical interviewer preparing questions for a ${role} position at ${difficulty} difficulty level.

Based on this candidate's resume, generate exactly ${totalQuestions} interview questions that test their claimed skills and experience.

CANDIDATE RESUME:
${resumeContext}

QUESTION DISTRIBUTION:
- 40% Technical questions (based on their listed skills/technologies)
- 25% Project-based questions (ask about specific projects they listed)
- 20% Behavioral questions (situation-based, using STAR format prompts)
- 15% HR/Culture-fit questions

RULES:
1. Questions should directly reference their resume content
2. Technical questions should probe depth of knowledge
3. Project questions should ask about challenges, decisions, architecture
4. Each question should have "expectedTopics" - key points a good answer should cover
5. Match difficulty level: easy=basics, medium=applied knowledge, hard=deep expertise + edge cases

Return ONLY valid JSON, no markdown:
{
  "questions": [
    {
      "question": "Full interview question text",
      "category": "technical" | "project" | "behavioral" | "hr",
      "expectedTopics": ["topic1", "topic2", "topic3"],
      "difficulty": "${difficulty}",
      "context": "Which part of resume this relates to"
    }
  ]
}`;

  const raw = await callGrok([{ role: "user", content: prompt }], 4096);

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Failed to parse interview questions");
  }

  const questions = parsed.questions || parsed;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("No interview questions generated");
  }

  return questions.slice(0, totalQuestions).map((q) => ({
    question: q.question,
    category: q.category || "technical",
    expectedTopics: q.expectedTopics || [],
    difficulty: q.difficulty || difficulty,
    context: q.context || "",
  }));
}

/**
 * Evaluate a spoken/transcribed answer against expected topics
 */
async function evaluateSpokenAnswer(
  question,
  transcript,
  expectedTopics,
  category,
  difficulty = "medium",
) {
  const normalizedTranscript = (transcript || "").trim();
  const strictness = getStrictnessConfig(difficulty);
  const expectedTopicList = Array.isArray(expectedTopics)
    ? expectedTopics.filter(Boolean).map((item) => String(item).trim())
    : [];
  const loweredAnswer = normalizedTranscript.toLowerCase();
  const matchedTopics = expectedTopicList.filter((item) =>
    loweredAnswer.includes(item.toLowerCase()),
  );
  const missingTopics = expectedTopicList.filter(
    (item) => !matchedTopics.includes(item),
  );
  const topicCoverage = expectedTopicList.length
    ? Math.round((matchedTopics.length / expectedTopicList.length) * 100)
    : 0;

  if (countWords(normalizedTranscript) < strictness.minWords) {
    return {
      score: 0,
      relevance: 0,
      depth: 0,
      communication: 0,
      topicCoverage,
      matchedTopics,
      missingTopics,
      feedback:
        "No meaningful answer was provided. Try to articulate your thoughts even if unsure.",
      strengths: [],
      improvements: ["Provide a verbal answer to the question"],
    };
  }

  const prompt = `You are an expert interview evaluator. Rate this candidate's spoken answer.

QUESTION: ${question}
CATEGORY: ${category}
DIFFICULTY: ${difficulty}
EXPECTED TOPICS TO COVER: ${expectedTopics.join(", ")}
DETERMINISTIC SIGNALS:
- Topic coverage: ${topicCoverage}/100
- Matched topics: ${matchedTopics.join(", ") || "none"}
- Missing topics: ${missingTopics.join(", ") || "none"}

CANDIDATE'S ANSWER (transcribed from speech):
"${normalizedTranscript}"

Evaluate the answer on these criteria (0-100 each):
1. **Relevance** - Does it actually answer the question?
2. **Depth** - Does it demonstrate deep understanding?
3. **Communication** - Is it well-structured and clear?

Also provide:
- An overall score (0-100, weighted average)
- 2-3 specific strengths
- 2-3 areas to improve
- Detailed feedback paragraph

Return ONLY valid JSON:
{
  "score": 75,
  "relevance": 80,
  "depth": 70,
  "communication": 75,
  "feedback": "Detailed feedback paragraph...",
  "strengths": ["Strength 1", "Strength 2"],
  "improvements": ["Improvement 1", "Improvement 2"]
}`;

  const raw = await callGrok([{ role: "user", content: prompt }], 2048);

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      score: Math.min(100, Math.max(0, parsed.score || 0)),
      relevance: Math.min(100, Math.max(0, parsed.relevance || 0)),
      depth: Math.min(100, Math.max(0, parsed.depth || 0)),
      communication: Math.min(100, Math.max(0, parsed.communication || 0)),
      topicCoverage,
      matchedTopics,
      missingTopics,
      feedback: parsed.feedback || "Evaluation complete.",
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
    };
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const p = JSON.parse(match[0]);
      return {
        score: Math.min(100, Math.max(0, p.score || 0)),
        relevance: Math.min(100, Math.max(0, p.relevance || 0)),
        depth: Math.min(100, Math.max(0, p.depth || 0)),
        communication: Math.min(100, Math.max(0, p.communication || 0)),
        topicCoverage,
        matchedTopics,
        missingTopics,
        feedback: p.feedback || "Evaluation complete.",
        strengths: p.strengths || [],
        improvements: p.improvements || [],
      };
    }
    return {
      score: 50,
      relevance: 50,
      depth: 50,
      communication: 50,
      topicCoverage,
      matchedTopics,
      missingTopics,
      feedback: "Could not fully evaluate the answer. Please try again.",
      strengths: [],
      improvements: [],
    };
  }
}

/**
 * Generate overall interview summary
 */
async function generateInterviewSummary(parsedResume, responses, config) {
  const responseSummary = responses
    .map(
      (r, i) =>
        `Q${i + 1} [${r.category}]: "${r.question}" → Score: ${r.evaluation?.score || 0}/100`,
    )
    .join("\n");

  const avgScore =
    responses.reduce((sum, r) => sum + (r.evaluation?.score || 0), 0) /
    (responses.length || 1);

  const prompt = `You are a senior hiring manager writing an interview assessment.

CANDIDATE: ${parsedResume.name || "Candidate"}
ROLE: ${config.role || "Software Engineer"}
DIFFICULTY: ${config.difficulty || "medium"}

QUESTION SCORES:
${responseSummary}

AVERAGE SCORE: ${avgScore.toFixed(1)}/100

Write a professional interview summary. Return ONLY valid JSON:
{
  "overallScore": ${Math.round(avgScore)},
  "grade": "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F",
  "summary": "2-3 paragraph professional assessment",
  "topStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "areasToImprove": ["Area 1", "Area 2", "Area 3"],
  "interviewReady": true/false
}

Grading scale: A+ (90-100), A (80-89), B+ (75-79), B (65-74), C+ (55-64), C (45-54), D (30-44), F (<30)`;

  const raw = await callGrok([{ role: "user", content: prompt }], 2048);

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  cleaned = sanitizeJsonString(cleaned);

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return {
      overallScore: Math.round(avgScore),
      grade:
        avgScore >= 80
          ? "A"
          : avgScore >= 65
            ? "B"
            : avgScore >= 45
              ? "C"
              : "D",
      summary: "Interview assessment could not be fully generated.",
      topStrengths: [],
      areasToImprove: [],
      interviewReady: avgScore >= 65,
    };
  }
}

function parseJsonFromAi(raw) {
  let cleaned = sanitizeJsonString((raw || "").trim());
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Failed to parse AI JSON");
  }
}

async function generateDocumentIdealAnswer(question) {
  const prompt = `You are a senior technical interviewer.

Question:
"${question}"

Create a high-quality reference answer suitable for evaluating an interview response.

Return ONLY valid JSON:
{
  "idealAnswer": "A concise but complete ideal answer in 4-8 lines",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
}`;

  const raw = await callGrok([{ role: "user", content: prompt }], 1400);

  try {
    const parsed = parseJsonFromAi(raw);
    return {
      idealAnswer: parsed.idealAnswer || "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    };
  } catch {
    return { idealAnswer: "", keyPoints: [] };
  }
}

async function evaluateDocumentInterviewAnswer({
  question,
  userAnswer,
  referenceAnswer,
  referenceSource,
  semanticSimilarity,
  missingTerms = [],
  difficulty = "medium",
}) {
  const strictness = getStrictnessConfig(difficulty);
  if (countWords(userAnswer) < strictness.minWords) {
    return {
      score: 0,
      relevance: 0,
      accuracy: 0,
      communicationClarity: 0,
      strengths: [],
      missingKeyPoints: ["No meaningful answer was provided."],
      suggestions: [
        "Speak your response with key concepts and concrete points.",
      ],
      feedback:
        "No meaningful response detected. Try answering with a structured explanation and examples.",
    };
  }

  const prompt = `You are evaluating an interview answer against a reference answer.

QUESTION:
${question}

REFERENCE ANSWER SOURCE: ${referenceSource}
DIFFICULTY: ${difficulty}
REFERENCE ANSWER:
${referenceAnswer}

USER ANSWER:
${userAnswer}

DETERMINISTIC SIGNALS:
- Semantic similarity score: ${semanticSimilarity}/100
- Missing key terms detected: ${missingTerms.join(", ") || "none"}

Return ONLY valid JSON:
{
  "score": 0-100,
  "relevance": 0-100,
  "accuracy": 0-100,
  "communicationClarity": 0-100,
  "strengths": ["strength 1", "strength 2"],
  "missingKeyPoints": ["point 1", "point 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "feedback": "one concise paragraph"
}

Rules:
1) Align with deterministic similarity signal.
2) Avoid hallucinations. Do not invent facts not present in the user answer.
3) Keep suggestions actionable and specific.`;

  const raw = await callGrok([{ role: "user", content: prompt }], 1800);

  try {
    const parsed = parseJsonFromAi(raw);
    const baseScore = Number(parsed.score || 0);
    const blendedScore = Math.round(
      baseScore * strictness.blendWeight +
        semanticSimilarity * (1 - strictness.blendWeight),
    );

    return {
      score: Math.min(100, Math.max(0, blendedScore)),
      relevance: Math.min(100, Math.max(0, Number(parsed.relevance || 0))),
      accuracy: Math.min(100, Math.max(0, Number(parsed.accuracy || 0))),
      communicationClarity: Math.min(
        100,
        Math.max(0, Number(parsed.communicationClarity || 0)),
      ),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      missingKeyPoints: Array.isArray(parsed.missingKeyPoints)
        ? parsed.missingKeyPoints
        : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      feedback: parsed.feedback || "Evaluation complete.",
    };
  } catch {
    return {
      score: semanticSimilarity,
      relevance: semanticSimilarity,
      accuracy: semanticSimilarity,
      communicationClarity: 60,
      strengths: [],
      missingKeyPoints: missingTerms.slice(0, 4),
      suggestions: [
        "Improve coverage of key concepts from the expected answer.",
        "Use a clearer structure: definition, reasoning, and example.",
      ],
      feedback: "Automatic fallback evaluation used due to parsing failure.",
    };
  }
}

async function generateDocumentInterviewSummary(responses, config = {}) {
  const responseSummary = (responses || [])
    .map(
      (r, i) =>
        `Q${i + 1}: Score ${r.evaluation?.score || 0}, Relevance ${r.evaluation?.relevance || 0}, Accuracy ${r.evaluation?.accuracy || 0}, Clarity ${r.evaluation?.communicationClarity || 0}`,
    )
    .join("\n");

  const avgScore =
    (responses || []).reduce(
      (sum, item) => sum + (item.evaluation?.score || 0),
      0,
    ) / ((responses || []).length || 1);

  const prompt = `You are a hiring manager summarizing a document-based mock interview.

ROLE: ${config.role || "Software Engineer"}
DIFFICULTY: ${config.difficulty || "medium"}

QUESTION RESULTS:
${responseSummary || "No responses provided."}

AVERAGE SCORE: ${avgScore.toFixed(1)}/100

Return ONLY valid JSON:
{
  "overallScore": ${Math.round(avgScore)},
  "grade": "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F",
  "summary": "short assessment paragraph",
  "topStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "areasToImprove": ["Area 1", "Area 2", "Area 3"],
  "interviewReady": true/false
}`;

  const raw = await callGrok([{ role: "user", content: prompt }], 1800);

  try {
    return parseJsonFromAi(raw);
  } catch {
    return {
      overallScore: Math.round(avgScore),
      grade:
        avgScore >= 80
          ? "A"
          : avgScore >= 65
            ? "B"
            : avgScore >= 45
              ? "C"
              : "D",
      summary: "Interview summary fallback generated locally.",
      topStrengths: [],
      areasToImprove: [],
      interviewReady: avgScore >= 65,
    };
  }
}

module.exports = {
  generateQuizQuestions,
  expandTopic,
  generateInterviewQuestion,
  evaluateInterviewAnswer,
  generateLiveInterviewQuestion,
  evaluateLiveInterviewAnswer,
  parseResumeContent,
  generateResumeQuestions,
  evaluateSpokenAnswer,
  generateInterviewSummary,
  generateDocumentIdealAnswer,
  evaluateDocumentInterviewAnswer,
  generateDocumentInterviewSummary,
};
