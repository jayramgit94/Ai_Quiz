const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "he",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
  "your",
  "you",
  "i",
  "we",
  "they",
  "this",
  "those",
  "these",
]);

const FILLER_WORDS = new Set([
  "uh",
  "um",
  "hmm",
  "huh",
  "ah",
  "like",
  "actually",
  "basically",
  "literally",
  "kinda",
  "sorta",
]);

const TOKEN_ALIASES = new Map([
  ["cse", "computerscienceengineering"],
  ["cs", "computerscience"],
  ["btech", "bacheloroftechnology"],
  ["be", "bachelorofengineering"],
  ["ai", "artificialintelligence"],
  ["ml", "machinelearning"],
  ["js", "javascript"],
  ["nodejs", "node"],
  ["reactjs", "react"],
  ["mongodb", "mongo"],
]);

const SYNONYM_GROUPS = [
  ["build", "create", "develop", "implement"],
  ["improve", "optimize", "enhance", "refine"],
  ["team", "collaborate", "collaboration", "teammate"],
  ["project", "application", "app", "system", "platform"],
  ["problem", "issue", "challenge", "difficulty"],
  ["learn", "study", "understand", "grasp"],
  ["explain", "describe", "clarify", "summarize"],
  ["experience", "worked", "background", "exposure"],
  ["lead", "led", "manage", "managed"],
];

const SYNONYM_CANONICAL = (() => {
  const map = new Map();
  for (const group of SYNONYM_GROUPS) {
    const canonical = group[0];
    for (const word of group) {
      map.set(word, canonical);
    }
  }
  return map;
})();

const QUESTION_STARTERS = new Set([
  "what",
  "why",
  "how",
  "when",
  "where",
  "who",
  "which",
  "can",
  "could",
  "would",
  "should",
  "is",
  "are",
  "do",
  "did",
  "does",
  "have",
  "has",
  "tell",
  "describe",
  "explain",
  "discuss",
  "define",
  "compare",
  "differentiate",
  "walk",
  "share",
  "give",
  "introduce",
  "list",
]);

const IMPLIED_INTERVIEW_QUESTION_PATTERNS = [
  /^tell\s+me\s+about\s+yourself\b/i,
  /^introduce\s+yourself\b/i,
  /^walk\s+me\s+through\b/i,
  /^describe\s+your\b/i,
  /^explain\s+your\b/i,
  /^share\s+(an?|your)\b/i,
  /^give\s+(an?|your)\b/i,
  /^what\s+are\s+your\b/i,
  /^why\s+(do|did|are|is|would|should|can)\b/i,
];

function normalizeWhitespace(text) {
  return (text || "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u00A0]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function stripQuestionPrefix(text) {
  return text
    .replace(
      /^\s*(?:[-*•]\s*|\d+[.):-]\s*|q(?:uestion)?\s*\d*\s*[:.)\-]?\s*)/i,
      "",
    )
    .trim();
}

function stripAnswerPrefix(text) {
  return text.replace(/^\s*(?:a(?:nswer)?[:.)\-])\s*/i, "").trim();
}

function isQuestionLine(line) {
  const value = stripQuestionPrefix(line || "");
  if (!value) return false;

  if (/^\s*(?:q(?:uestion)?\s*\d*[:.)\-]|\d+[:.)\-])\s*.+/i.test(line)) {
    return true;
  }

  if (/\?$/.test(value) && value.length >= 8) return true;

  const normalized = value.replace(/["'“”]/g, "").trim();
  const firstWord = (normalized.match(/^([a-z]+)/i) || [])[1]?.toLowerCase();

  const hasStarter = firstWord ? QUESTION_STARTERS.has(firstWord) : false;
  const matchesInterviewPrompt = IMPLIED_INTERVIEW_QUESTION_PATTERNS.some(
    (re) => re.test(normalized),
  );

  const isImplicitQuestionStarter = (() => {
    if (!firstWord) return false;

    // Imperative interview prompts (no '?' needed)
    if (
      [
        "tell",
        "describe",
        "explain",
        "discuss",
        "define",
        "compare",
        "differentiate",
        "walk",
        "share",
        "give",
        "introduce",
        "list",
      ].includes(firstWord)
    ) {
      return true;
    }

    // Interrogative starters require question-like phrasing when no '?'
    if (firstWord === "what")
      return /^what\s+(is|are|was|were|do|does|did|can|could|would|should|has|have|why|when|where|which|who|your)\b/i.test(
        normalized,
      );
    if (firstWord === "why")
      return /^why\s+(is|are|do|does|did|can|could|would|should|has|have)\b/i.test(
        normalized,
      );
    if (firstWord === "how")
      return /^how\s+(do|does|did|can|could|would|should|is|are|has|have)\b/i.test(
        normalized,
      );
    if (firstWord === "which")
      return /^which\s+(is|are|one|option|approach|statement|of)\b/i.test(
        normalized,
      );
    if (
      [
        "can",
        "could",
        "would",
        "should",
        "is",
        "are",
        "do",
        "did",
        "does",
        "have",
        "has",
        "when",
        "where",
        "who",
      ].includes(firstWord)
    ) {
      if (!/^[A-Z]/.test(value.trim())) return false;
      return true;
    }

    return false;
  })();

  if (!hasStarter && !matchesInterviewPrompt) return false;

  // Avoid classifying long declarative answer paragraphs as questions.
  if (normalized.length > 220 && !/\?$/.test(normalized)) return false;

  // Without explicit question mark/prefix, require stronger implicit signal.
  if (
    !/\?$/.test(normalized) &&
    !matchesInterviewPrompt &&
    !isImplicitQuestionStarter
  ) {
    return false;
  }

  // Keep only question-like single lines and short prompts.
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return wordCount >= 3 && wordCount <= 45;
}

function shouldContinueQuestionLine(currentQuestion, nextLine) {
  const question = String(currentQuestion || "").trim();
  const line = String(nextLine || "").trim();
  if (!question || !line) return false;

  const questionWords = question.split(/\s+/).filter(Boolean).length;
  const firstWord = (line.match(/^([a-z]+)/i) || [])[1]?.toLowerCase() || "";

  // If current prompt already looks complete, next line is likely answer text.
  if (/[:?.!]$/.test(question)) return false;
  if (questionWords >= 7) return false;

  // Continue question only when next line also looks like a prompt fragment.
  if (QUESTION_STARTERS.has(firstWord)) return true;
  if (/^(and|or|with|without|about|regarding|including)\b/i.test(line)) {
    return true;
  }

  return false;
}

function extractInlineQA(text) {
  const results = [];
  const regex =
    /(?:^|\n)\s*(?:q(?:uestion)?\s*\d*[:.)\-]?\s*)([\s\S]*?)(?:\n|\s{2,})(?:a(?:nswer)?[:.)\-]\s*)([\s\S]*?)(?=(?:\n\s*(?:q(?:uestion)?\s*\d*[:.)\-]?|\d+[:.)\-]))|\n{2,}|$)/gi;

  let match = regex.exec(text);
  while (match) {
    const question = stripQuestionPrefix(match[1] || "");
    const answer = stripAnswerPrefix(match[2] || "");
    if (question.length >= 8) {
      results.push({ question, providedAnswer: answer || "" });
    }
    match = regex.exec(text);
  }

  return results;
}

function parseQuestionAnswerDocument(rawText) {
  const cleaned = normalizeWhitespace(rawText || "");
  if (!cleaned) {
    return [];
  }

  const parsed = [...extractInlineQA(cleaned)];
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let currentQuestion = "";
  let answerLines = [];
  let collectingAnswer = false;

  const commitCurrent = () => {
    const question = stripQuestionPrefix(currentQuestion);
    const providedAnswer = answerLines.join(" ").trim();

    if (question.length >= 8) {
      parsed.push({ question, providedAnswer });
    }

    currentQuestion = "";
    answerLines = [];
    collectingAnswer = false;
  };

  for (const line of lines) {
    if (isQuestionLine(line)) {
      if (currentQuestion) {
        commitCurrent();
      }
      currentQuestion = stripQuestionPrefix(line);
      continue;
    }

    if (/^\s*a(?:nswer)?[:.)\-]/i.test(line) && currentQuestion) {
      collectingAnswer = true;
      const stripped = stripAnswerPrefix(line);
      if (stripped) answerLines.push(stripped);
      continue;
    }

    if (!currentQuestion) {
      continue;
    }

    if (!collectingAnswer) {
      // Keep multiline questions together only when next line still looks like question text.
      if (
        currentQuestion.length < 220 &&
        shouldContinueQuestionLine(currentQuestion, line)
      ) {
        currentQuestion = `${currentQuestion} ${line}`.trim();
        continue;
      }

      collectingAnswer = true;
      answerLines.push(line);
      continue;
    }

    answerLines.push(line);
  }

  if (currentQuestion) {
    commitCurrent();
  }

  // Deduplicate by normalized question text.
  const seen = new Set();
  return parsed
    .map((item, idx) => ({
      question: item.question.replace(/\s+/g, " ").trim(),
      providedAnswer: (item.providedAnswer || "").replace(/\s+/g, " ").trim(),
      index: idx,
    }))
    .filter((item) => {
      const key = item.question.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item, idx) => ({
      ...item,
      index: idx,
      hasProvidedAnswer: Boolean(item.providedAnswer),
    }));
}

function normalizeQuestionKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function normalizeSemanticPhrases(text) {
  return String(text || "")
    .replace(
      /\bcomputer\s+science\s+engineering\b/gi,
      " computerscienceengineering ",
    )
    .replace(/\bcomputer\s+science\b/gi, " computerscience ")
    .replace(/\bartificial\s+intelligence\b/gi, " artificialintelligence ")
    .replace(/\bmachine\s+learning\b/gi, " machinelearning ")
    .replace(/\bdeep\s+learning\b/gi, " deeplearning ")
    .replace(/\bdata\s+structures\b/gi, " datastructures ")
    .replace(/\bobject\s+oriented\s+programming\b/gi, " oop ")
    .replace(/\bproblem\s+solving\b/gi, " problemsolving ");
}

function stemToken(token) {
  let normalized = token;
  if (normalized.endsWith("ing") && normalized.length > 5) {
    normalized = normalized.slice(0, -3);
  } else if (normalized.endsWith("ied") && normalized.length > 5) {
    normalized = `${normalized.slice(0, -3)}y`;
  } else if (normalized.endsWith("ed") && normalized.length > 4) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith("es") && normalized.length > 4) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith("s") && normalized.length > 3) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function canonicalizeToken(token) {
  const alias = TOKEN_ALIASES.get(token) || token;
  const stemmed = stemToken(alias);
  return SYNONYM_CANONICAL.get(stemmed) || stemmed;
}

function normalizeExtractedPairs(pairs = []) {
  return (Array.isArray(pairs) ? pairs : [])
    .map((item) => ({
      question: String(item?.question || "")
        .replace(/\s+/g, " ")
        .trim(),
      providedAnswer: String(item?.providedAnswer || "")
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((item) => item.question.length >= 6)
    .map((item, index) => ({
      ...item,
      index,
      hasProvidedAnswer: Boolean(item.providedAnswer),
    }));
}

function mergeExtractedQuestionAnswers(rulePairs = [], aiPairs = []) {
  const merged = new Map();

  const apply = (list = [], source = "rule") => {
    for (const item of normalizeExtractedPairs(list)) {
      const key = normalizeQuestionKey(item.question);
      if (!key) continue;

      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, {
          question: item.question,
          providedAnswer: item.providedAnswer,
          hasProvidedAnswer: Boolean(item.providedAnswer),
          source,
        });
        continue;
      }

      // Prefer entries that contain an answer, then prefer longer/more complete question text.
      if (!existing.hasProvidedAnswer && item.providedAnswer) {
        existing.providedAnswer = item.providedAnswer;
        existing.hasProvidedAnswer = true;
      }

      if ((item.question || "").length > (existing.question || "").length) {
        existing.question = item.question;
      }
    }
  };

  apply(rulePairs, "rule");
  apply(aiPairs, "ai");

  return [...merged.values()].map((item, index) => ({
    question: item.question,
    providedAnswer: item.providedAnswer || "",
    hasProvidedAnswer: Boolean(item.providedAnswer),
    index,
  }));
}

function tokenize(value) {
  const rawTokens = normalizeSemanticPhrases(value || "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .map((token) =>
      canonicalizeToken(token.toLowerCase().replace(/[^a-z0-9]/g, "")),
    )
    .filter(
      (token) =>
        token &&
        token.length > 1 &&
        !STOP_WORDS.has(token) &&
        !FILLER_WORDS.has(token),
    );

  // Avoid speech-to-text stutter biasing similarity by collapsing long repeats.
  const deduped = [];
  let prev = "";
  let repeatCount = 0;
  for (const token of rawTokens) {
    if (token === prev) {
      repeatCount += 1;
    } else {
      prev = token;
      repeatCount = 1;
    }
    if (repeatCount <= 2) deduped.push(token);
  }

  return deduped;
}

function toFrequencyMap(tokens) {
  const map = new Map();
  for (const token of tokens) {
    // Cap token frequency to reduce repeated-word inflation from speech recognition.
    const next = (map.get(token) || 0) + 1;
    map.set(token, Math.min(next, 3));
  }
  return map;
}

function levenshteinDistance(a = "", b = "") {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

function cosineSimilarity(tokensA, tokensB) {
  const mapA = toFrequencyMap(tokensA);
  const mapB = toFrequencyMap(tokensB);

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const value of mapA.values()) {
    magA += value * value;
  }
  for (const value of mapB.values()) {
    magB += value * value;
  }

  for (const [token, freqA] of mapA.entries()) {
    const freqB = mapB.get(token) || 0;
    dot += freqA * freqB;
  }

  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function jaccardSimilarity(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  if (!setA.size || !setB.size) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }

  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function compareAnswers(userAnswer, referenceAnswer) {
  const userTokens = tokenize(userAnswer);
  const refTokens = tokenize(referenceAnswer);

  const cosine = cosineSimilarity(userTokens, refTokens);
  const jaccard = jaccardSimilarity(userTokens, refTokens);

  const refFrequency = toFrequencyMap(refTokens);
  const keyTerms = [...refFrequency.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0].length - a[0].length;
    })
    .map(([term]) => term)
    .slice(0, 22);
  const userSet = new Set(userTokens);

  const softMatch = (term) => {
    if (userSet.has(term)) return true;
    for (const token of userSet) {
      if (token.startsWith(term) || term.startsWith(token)) return true;
      if (token.includes(term) || term.includes(token)) {
        if (Math.min(token.length, term.length) >= 4) return true;
      }
      const distance = levenshteinDistance(token, term);
      const allowed = Math.max(
        1,
        Math.floor(Math.min(token.length, term.length) * 0.2),
      );
      if (distance <= allowed) return true;
    }
    return false;
  };

  const matched = keyTerms.filter((term) => softMatch(term));
  const keyCoverage = keyTerms.length ? matched.length / keyTerms.length : 0;

  const lengthBonus =
    userTokens.length >= 8 && refTokens.length >= 8
      ? 0.04
      : userTokens.length >= 4
        ? 0.02
        : 0;

  const semanticSimilarity = Math.round(
    Math.min(
      1,
      cosine * 0.42 + jaccard * 0.2 + keyCoverage * 0.34 + lengthBonus,
    ) * 100,
  );

  return {
    semanticSimilarity,
    cosine: Math.round(cosine * 100),
    jaccard: Math.round(jaccard * 100),
    keyCoverage: Math.round(keyCoverage * 100),
    matchedKeyTerms: matched,
    missingKeyTerms: keyTerms.filter((term) => !softMatch(term)).slice(0, 8),
  };
}

module.exports = {
  parseQuestionAnswerDocument,
  mergeExtractedQuestionAnswers,
  normalizeExtractedPairs,
  compareAnswers,
};
