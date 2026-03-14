import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  addToLeaderboard,
  generateQuiz,
  recordQuiz,
  submitQuiz,
} from "../services/api";
import "./QuizScreen.css";

const LOADING_STEPS = [
  "Analyzing topic...",
  "Generating questions...",
  "Validating quality...",
  "Preparing quiz...",
];

export default function QuizScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useAuth();
  const {
    userName: stateUserName,
    topic,
    difficulty,
    numQuestions,
  } = location.state || {};
  const userName = stateUserName || user?.displayName || "Guest";

  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [confidence, setConfidence] = useState("medium");
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);
  const questionStartTime = useRef(Date.now());

  // Loading step animation
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((prev) =>
        prev < LOADING_STEPS.length - 1 ? prev + 1 : prev,
      );
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  // Load quiz
  useEffect(() => {
    if (!topic) {
      navigate("/setup");
      return;
    }
    const loadQuiz = async () => {
      try {
        const res = await generateQuiz({
          topic,
          difficulty,
          count: numQuestions,
          userName,
        });
        setQuestions(res.data.questions);
        setSessionId(res.data.sessionId);
        setLoading(false);
        questionStartTime.current = Date.now();
      } catch (err) {
        setError(
          err.response?.data?.error ||
            "Failed to generate quiz. Please try again.",
        );
        setLoading(false);
      }
    };
    loadQuiz();
  }, [topic, difficulty, numQuestions, userName, navigate]);

  // Timer
  useEffect(() => {
    if (loading || showResult) return;
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [loading, currentIndex, showResult]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  const handleSelectAnswer = (answer) => {
    if (showResult) return;
    // Extract letter from option like "A) Option text" or just "A"
    const letter = answer.charAt(0);
    setSelectedAnswer(letter);
  };

  const handleConfirm = () => {
    if (!selectedAnswer) return;
    const timeTaken = Math.round(
      (Date.now() - questionStartTime.current) / 1000,
    );

    const correctAnswer = questions[currentIndex].correctAnswer || "";
    const isCorrect = selectedAnswer === correctAnswer.charAt(0);

    setAnswers((prev) => [
      ...prev,
      {
        questionIndex: currentIndex,
        selectedAnswer,
        confidence,
        timeTaken,
        isCorrect,
      },
    ]);
    setShowResult(true);
    clearInterval(timerRef.current);
  };

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setConfidence("medium");
      setShowResult(false);
      setTimer(0);
      questionStartTime.current = Date.now();
    } else {
      // Quiz complete - submit
      handleSubmit();
    }
    // eslint-disable-next-line
  }, [currentIndex, questions.length]);

  const handleSubmit = async () => {
    try {
      const finalAnswers =
        answers.length === questions.length ? answers : [...answers];
      const res = await submitQuiz({ sessionId, answers: finalAnswers });

      // Add to leaderboard
      try {
        await addToLeaderboard({
          userName,
          score: res.data.score,
          accuracy: res.data.accuracy,
          speedScore: res.data.speedScore,
          finalScore: res.data.finalScore,
          topic,
          difficulty,
          totalQuestions: res.data.totalQuestions,
        });
      } catch (e) {
        console.warn("Leaderboard update failed:", e);
      }

      // Record quiz for XP/achievements
      let xpData = null;
      if (user) {
        try {
          const xpRes = await recordQuiz({
            sessionId,
            topic,
            difficulty,
            accuracy: res.data.accuracy,
            score: res.data.score,
            totalQuestions: res.data.totalQuestions,
            speedScore: res.data.speedScore,
            finalScore: res.data.finalScore,
            weakTopics: res.data.weakTopics,
            strongTopics: res.data.strongTopics,
            nextDifficulty: res.data.nextDifficulty,
            detailedResults: res.data.detailedResults,
          });
          xpData = xpRes.data;
          updateUser(xpData.user);
        } catch (e) {
          console.warn("XP record failed:", e);
        }
      }

      navigate("/score", {
        state: { results: res.data, userName, topic, xpData },
      });
    } catch (err) {
      console.error("Submit failed:", err);
      navigate("/score", {
        state: {
          results: {
            score: answers.filter((a) => a.isCorrect).length,
            totalQuestions: questions.length,
            accuracy: Math.round(
              (answers.filter((a) => a.isCorrect).length / questions.length) *
                100,
            ),
            speedScore: 0,
            finalScore: 0,
            weakTopics: [],
            strongTopics: [],
            nextDifficulty: difficulty,
            confidenceStats: {},
            detailedResults: [],
          },
          userName,
          topic,
        },
      });
    }
  };

  // ─── LOADING ───
  if (loading) {
    return (
      <div className="quiz-page">
        <div className="loading-screen">
          <div className="spinner" />
          <h3>Generating Your Quiz</h3>
          <div className="loading-steps">
            {LOADING_STEPS.map((step, i) => (
              <div
                key={i}
                className={`loading-step ${i < loadingStep ? "done" : i === loadingStep ? "active" : ""}`}
              >
                <div className="step-icon">{i < loadingStep ? "✓" : ""}</div>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── ERROR ───
  if (error) {
    return (
      <div className="quiz-page">
        <div
          className="container-sm"
          style={{ paddingTop: 80, textAlign: "center" }}
        >
          <div className="card animate-scale-in" style={{ padding: 48 }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>❌</div>
            <h2>Oops!</h2>
            <p style={{ margin: "12px 0 24px" }}>{error}</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/setup")}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const lastAnswer = showResult ? answers[answers.length - 1] : null;

  return (
    <div className="quiz-page">
      <div className="container-sm">
        {/* Header */}
        <div className="quiz-header animate-fade-in">
          <div className="quiz-meta">
            <span className="badge badge-primary">{topic}</span>
            <span className="badge badge-warning">{difficulty}</span>
          </div>
          <div className="quiz-timer">
            <span className="timer-icon">⏱</span>
            <span className="timer-value">{formatTime(timer)}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="quiz-progress">
          <div className="progress-info">
            <span>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div
          className="question-card card animate-slide-right"
          key={currentIndex}
        >
          <div className="question-number">Q{currentIndex + 1}</div>
          <h3 className="question-text">{question?.question}</h3>

          <div className="options-list">
            {question?.options?.map((opt, i) => {
              const letter = opt.charAt(0);
              const isSelected = selectedAnswer === letter;
              const isCorrect =
                showResult &&
                letter === (question.correctAnswer || "").charAt(0);
              const isWrong = showResult && isSelected && !isCorrect;

              return (
                <button
                  key={i}
                  className={`option-btn ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                  onClick={() => handleSelectAnswer(opt)}
                  disabled={showResult}
                >
                  <span className="option-letter">{letter}</span>
                  <span className="option-text">{opt.substring(2).trim()}</span>
                  {isCorrect && <span className="option-check">✓</span>}
                  {isWrong && <span className="option-cross">✕</span>}
                </button>
              );
            })}
          </div>

          {/* Confidence selector (before confirming) */}
          {!showResult && selectedAnswer && (
            <div className="confidence-section animate-fade-in-up">
              <label className="confidence-label">How confident are you?</label>
              <div className="confidence-buttons">
                {[
                  { val: "high", icon: "💪", label: "High" },
                  { val: "medium", icon: "🤔", label: "Medium" },
                  { val: "guess", icon: "🎲", label: "Guess" },
                ].map((c) => (
                  <button
                    key={c.val}
                    className={`confidence-btn ${confidence === c.val ? `active ${c.val}` : ""}`}
                    onClick={() => setConfidence(c.val)}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirm / Next */}
          {!showResult ? (
            <button
              className="btn btn-primary btn-block confirm-btn"
              onClick={handleConfirm}
              disabled={!selectedAnswer}
            >
              Confirm Answer
            </button>
          ) : (
            <div className="result-section animate-fade-in-up">
              {/* Result banner */}
              <div
                className={`result-banner ${lastAnswer?.isCorrect ? "correct" : "wrong"}`}
              >
                <span className="result-emoji">
                  {lastAnswer?.isCorrect ? "🎉" : "😔"}
                </span>
                <span className="result-text">
                  {lastAnswer?.isCorrect ? "Correct!" : "Incorrect"}
                </span>
              </div>

              {/* Explanation */}
              {question?.explanation && (
                <div className="explanation-box">
                  <div className="explanation-section">
                    <div className="exp-header">📖 Explanation</div>
                    <p>{question.explanation}</p>
                  </div>
                  {question?.example && (
                    <div className="explanation-section">
                      <div className="exp-header">💡 Example</div>
                      <p>{question.example}</p>
                    </div>
                  )}
                  {question?.interviewTip && (
                    <div className="explanation-section">
                      <div className="exp-header">🎯 Interview Tip</div>
                      <p>{question.interviewTip}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                className="btn btn-primary btn-block"
                onClick={handleNext}
              >
                {currentIndex < questions.length - 1
                  ? "Next Question →"
                  : "See Results →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
