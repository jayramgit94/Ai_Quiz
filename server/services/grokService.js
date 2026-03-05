const axios = require("axios");

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

  return response.data.choices[0].message.content;
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
  let cleaned = raw.trim();
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
 * Evaluate interview answer using Grok
 */
async function evaluateInterviewAnswer(
  topic,
  question,
  userAnswer,
  questionNumber,
) {
  const prompt = `You are a technical interviewer evaluating an answer.

Topic: ${topic}
Question: ${question}
User's answer: ${userAnswer}

Evaluate the answer and generate a follow-up question.

Return ONLY valid JSON:
{
  "evaluation": "correct" or "partially_correct" or "incorrect",
  "feedback": "Detailed feedback on the answer",
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
    evaluation: parsed.evaluation || "incorrect",
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
) {
  if (!transcript || transcript.trim().length < 5) {
    return {
      score: 0,
      relevance: 0,
      depth: 0,
      communication: 0,
      feedback:
        "No meaningful answer was provided. Try to articulate your thoughts even if unsure.",
      strengths: [],
      improvements: ["Provide a verbal answer to the question"],
    };
  }

  const prompt = `You are an expert interview evaluator. Rate this candidate's spoken answer.

QUESTION: ${question}
CATEGORY: ${category}
EXPECTED TOPICS TO COVER: ${expectedTopics.join(", ")}

CANDIDATE'S ANSWER (transcribed from speech):
"${transcript}"

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

module.exports = {
  generateQuizQuestions,
  expandTopic,
  generateInterviewQuestion,
  evaluateInterviewAnswer,
  parseResumeContent,
  generateResumeQuestions,
  evaluateSpokenAnswer,
  generateInterviewSummary,
};
