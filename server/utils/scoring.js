/**
 * Calculate quiz scores including accuracy, speed, final score,
 * confidence analysis, weak/strong topics, and next difficulty.
 */
function calculateScores(questions, answers) {
  const totalQuestions = questions.length;
  const correctAnswers = answers.filter((a) => a.isCorrect).length;

  // ─── ACCURACY SCORE ───
  const accuracy = Math.round((correctAnswers / totalQuestions) * 100);

  // ─── SPEED SCORE ───
  // Average time per question, faster = higher score
  const totalTime = answers.reduce((sum, a) => sum + (a.timeTaken || 0), 0);
  const avgTime = totalTime / totalQuestions;
  // 30s baseline: under 30s = bonus, over 30s = penalty
  const speedScore = Math.max(0, Math.min(100, Math.round(100 - (avgTime - 10) * 2)));

  // ─── FINAL SCORE ───
  // Weighted: 70% accuracy + 30% speed
  const finalScore = Math.round(accuracy * 0.7 + speedScore * 0.3);

  // ─── CONFIDENCE ANALYSIS ───
  const confidenceStats = calculateConfidenceStats(answers);

  // ─── TOPIC ANALYSIS ───
  const { weakTopics, strongTopics } = analyzeTopics(questions, answers);

  // ─── NEXT DIFFICULTY (AI Difficulty Calibration) ───
  const nextDifficulty = calibrateDifficulty(accuracy, questions[0]?.difficulty || "medium");

  // ─── DETAILED RESULTS ───
  const detailedResults = questions.map((q, i) => {
    const answer = answers.find((a) => a.questionIndex === i);
    return {
      question: q.question,
      correctAnswer: q.correctAnswer,
      selectedAnswer: answer?.selectedAnswer || "—",
      isCorrect: answer?.isCorrect || false,
      confidence: answer?.confidence || "medium",
      timeTaken: answer?.timeTaken || 0,
    };
  });

  return {
    score: correctAnswers,
    totalQuestions,
    accuracy,
    speedScore,
    finalScore,
    weakTopics,
    strongTopics,
    nextDifficulty,
    confidenceStats,
    detailedResults,
  };
}

/**
 * Calculate confidence-based metrics
 */
function calculateConfidenceStats(answers) {
  const highConfidence = answers.filter((a) => a.confidence === "high");
  const guesses = answers.filter((a) => a.confidence === "guess");

  // Overconfidence errors: said "high" but got wrong
  const overconfidenceErrors = highConfidence.filter((a) => !a.isCorrect).length;

  // Guess accuracy: right when guessing
  const guessCorrect = guesses.filter((a) => a.isCorrect).length;
  const guessAccuracy = guesses.length > 0 ? Math.round((guessCorrect / guesses.length) * 100) : 0;

  // Confidence score: how well calibrated is the user
  // High confidence + correct = good, High confidence + wrong = bad
  let calibrationScore = 0;
  let totalWeight = 0;

  answers.forEach((a) => {
    if (a.confidence === "high") {
      calibrationScore += a.isCorrect ? 1 : -0.5;
      totalWeight += 1;
    } else if (a.confidence === "medium") {
      calibrationScore += a.isCorrect ? 0.5 : 0;
      totalWeight += 0.5;
    } else {
      // guess
      calibrationScore += a.isCorrect ? 0.3 : 0.1;
      totalWeight += 0.3;
    }
  });

  const confidenceScore =
    totalWeight > 0 ? Math.max(0, Math.min(100, Math.round((calibrationScore / totalWeight) * 100))) : 0;

  return {
    overconfidenceErrors,
    guessAccuracy,
    confidenceScore,
  };
}

/**
 * Analyze which subtopics are strong vs weak
 */
function analyzeTopics(questions, answers) {
  const topicMap = {};

  questions.forEach((q, i) => {
    const subtopic = q.topic || "General";
    if (!topicMap[subtopic]) {
      topicMap[subtopic] = { correct: 0, total: 0 };
    }
    topicMap[subtopic].total++;

    const answer = answers.find((a) => a.questionIndex === i);
    if (answer?.isCorrect) {
      topicMap[subtopic].correct++;
    }
  });

  const weakTopics = [];
  const strongTopics = [];

  Object.entries(topicMap).forEach(([topic, stats]) => {
    const acc = stats.total > 0 ? stats.correct / stats.total : 0;
    if (acc >= 0.7) {
      strongTopics.push(topic);
    } else if (acc < 0.5) {
      weakTopics.push(topic);
    }
  });

  return { weakTopics, strongTopics };
}

/**
 * AI Difficulty Calibration
 * Adjust difficulty based on accuracy
 */
function calibrateDifficulty(accuracy, currentDifficulty) {
  if (accuracy >= 80) {
    // User is doing great → increase difficulty
    if (currentDifficulty === "easy") return "medium";
    if (currentDifficulty === "medium") return "hard";
    return "hard";
  } else if (accuracy < 40) {
    // User is struggling → decrease difficulty
    if (currentDifficulty === "hard") return "medium";
    if (currentDifficulty === "medium") return "easy";
    return "easy";
  }
  // Accuracy between 40-80 → keep same difficulty
  return currentDifficulty;
}

module.exports = {
  calculateScores,
  calculateConfidenceStats,
  analyzeTopics,
  calibrateDifficulty,
};
