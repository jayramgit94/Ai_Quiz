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
    .replace(/^\s*(?:q(?:uestion)?\s*\d*[:.)\-]?|\d+[:.)\-])\s*/i, "")
    .trim();
}

function stripAnswerPrefix(text) {
  return text.replace(/^\s*(?:a(?:nswer)?[:.)\-])\s*/i, "").trim();
}

function isQuestionLine(line) {
  const value = (line || "").trim();
  if (!value) return false;

  if (/^\s*(?:q(?:uestion)?\s*\d*[:.)\-]|\d+[:.)\-])\s*.+/i.test(value)) {
    return true;
  }

  // Fallback: treat sentence ending in ? as a question candidate.
  return /\?$/.test(value) && value.length >= 10;
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
      // Keep multiline questions together when parser split by lines.
      if (currentQuestion.length < 220) {
        currentQuestion = `${currentQuestion} ${line}`.trim();
      }

      if (/\?$/.test(currentQuestion) && line.length > 20) {
        collectingAnswer = true;
        answerLines.push(line);
      }
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

function tokenize(value) {
  const normalizeToken = (token) => {
    if (!token) return "";
    let normalized = token.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalized.endsWith("ing") && normalized.length > 5) {
      normalized = normalized.slice(0, -3);
    } else if (normalized.endsWith("ed") && normalized.length > 4) {
      normalized = normalized.slice(0, -2);
    } else if (normalized.endsWith("es") && normalized.length > 4) {
      normalized = normalized.slice(0, -2);
    } else if (normalized.endsWith("s") && normalized.length > 3) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  };

  return (value || "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token && token.length > 1 && !STOP_WORDS.has(token));
}

function toFrequencyMap(tokens) {
  const map = new Map();
  for (const token of tokens) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  return map;
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
    missingKeyTerms: keyTerms.filter((term) => !userSet.has(term)).slice(0, 8),
  };
}

module.exports = {
  parseQuestionAnswerDocument,
  compareAnswers,
};
