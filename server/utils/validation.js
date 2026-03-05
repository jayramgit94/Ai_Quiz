/**
 * Anti-Hallucination Validation Layer
 * Validates AI-generated questions for quality and correctness
 */

/**
 * Validate a single question object
 */
function validateQuestion(q, index) {
  const errors = [];

  // 1. Must have exactly 4 options
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    errors.push(`Q${index + 1}: Must have exactly 4 options (has ${q.options?.length || 0})`);
  }

  // 2. Correct answer must be one of the option letters
  if (q.correctAnswer) {
    const letter = q.correctAnswer.charAt(0).toUpperCase();
    if (!["A", "B", "C", "D"].includes(letter)) {
      errors.push(`Q${index + 1}: correctAnswer "${q.correctAnswer}" is not A/B/C/D`);
    }
    // Check option with that letter exists
    if (q.options) {
      const matchingOpt = q.options.find((opt) => opt.charAt(0).toUpperCase() === letter);
      if (!matchingOpt) {
        errors.push(`Q${index + 1}: No option starts with letter "${letter}"`);
      }
    }
  } else {
    errors.push(`Q${index + 1}: Missing correctAnswer`);
  }

  // 3. Explanation references correct answer (must not be empty)
  if (!q.explanation || q.explanation.trim().length < 10) {
    errors.push(`Q${index + 1}: Explanation is missing or too short`);
  }

  // 4. Question text not empty
  if (!q.question || q.question.trim().length < 10) {
    errors.push(`Q${index + 1}: Question text is missing or too short`);
  }

  // 5. Options must not be identical
  if (q.options) {
    const optTexts = q.options.map((o) => o.substring(2).trim().toLowerCase());
    const uniqueOpts = new Set(optTexts);
    if (uniqueOpts.size < 4) {
      errors.push(`Q${index + 1}: Duplicate options found`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate full question set and remove duplicates
 */
function validateQuestionSet(questions) {
  const validationResults = [];
  const validQuestions = [];
  const seenQuestions = new Set();

  questions.forEach((q, i) => {
    const result = validateQuestion(q, i);
    validationResults.push(result);

    if (result.valid) {
      // Check for duplicate questions
      const normalized = q.question.toLowerCase().trim();
      if (!seenQuestions.has(normalized)) {
        seenQuestions.add(normalized);
        validQuestions.push(q);
      }
    }
  });

  return {
    validQuestions,
    totalInput: questions.length,
    totalValid: validQuestions.length,
    issues: validationResults.filter((r) => !r.valid).flatMap((r) => r.errors),
  };
}

module.exports = {
  validateQuestion,
  validateQuestionSet,
};
