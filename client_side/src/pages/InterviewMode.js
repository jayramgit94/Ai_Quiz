import { FileText, MessageSquare, Mic } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { startInterview, submitInterviewAnswer } from "../services/api";
import "./InterviewMode.css";

export default function InterviewMode() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]);

  const handleStart = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await startInterview({ topic: topic.trim(), difficulty });
      setCurrentQuestion(res.data.currentQuestion);
      setQuestionNumber(res.data.questionNumber);
      setStarted(true);
    } catch (err) {
      console.error("Interview start failed:", err);
    }
    setLoading(false);
  };

  const handleAnswer = async () => {
    if (!selectedAnswer) return;
    setLoading(true);
    try {
      const res = await submitInterviewAnswer({
        topic,
        previousQuestion: currentQuestion.question,
        userAnswer: selectedAnswer,
        questionNumber,
        options: currentQuestion.options,
        correctAnswer: currentQuestion.correctAnswer,
      });

      setFeedback(res.data);

      // Add to history
      setHistory((prev) => [
        ...prev,
        {
          question: currentQuestion,
          userAnswer: selectedAnswer,
          evaluation: res.data.evaluation,
          feedback: res.data.feedback,
        },
      ]);
    } catch (err) {
      console.error("Interview answer failed:", err);
    }
    setLoading(false);
  };

  const handleNextQuestion = () => {
    if (feedback?.followUpQuestion) {
      setCurrentQuestion(feedback.followUpQuestion);
      setQuestionNumber(feedback.questionNumber);
    }
    setSelectedAnswer(null);
    setFeedback(null);
  };

  const getEvalColor = (eval_) => {
    if (eval_ === "correct") return "var(--success)";
    if (eval_ === "partially_correct") return "var(--warning)";
    return "var(--error)";
  };

  const getEvalEmoji = (eval_) => {
    if (eval_ === "correct") return "✅";
    if (eval_ === "partially_correct") return "🟡";
    return "❌";
  };

  // ─── SETUP ───
  if (!started) {
    return (
      <div className="interview-page has-navbar">
        <div className="container-sm">
          <button
            className="btn btn-ghost btn-sm back-btn"
            onClick={() => navigate("/")}
          >
            ← Back
          </button>

          <div className="card interview-setup animate-fade-in-up">
            <div className="setup-header">
              <span className="setup-icon">
                <MessageSquare size={30} />
              </span>
              <h2>Interview Simulation</h2>
              <p>AI-powered mock interview with adaptive follow-up questions</p>
            </div>

            <div className="interview-flow" style={{ marginBottom: "1rem" }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate("/resume-interview")}
              >
                <Mic size={14} style={{ marginRight: 6 }} /> Resume Interview
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate("/document-interview")}
              >
                <FileText size={14} style={{ marginRight: 6 }} /> Document
                Interview
              </button>
            </div>

            <div className="interview-flow">
              <div className="flow-step">
                <span className="flow-num">1</span>
                <span>AI asks a question</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <span className="flow-num">2</span>
                <span>You answer</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <span className="flow-num">3</span>
                <span>AI evaluates & explains</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <span className="flow-num">4</span>
                <span>Follow-up question</span>
              </div>
            </div>

            <div className="input-group">
              <label>Topic</label>
              <input
                className="input"
                placeholder="e.g. DBMS, System Design, OOP"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Difficulty</label>
              <select
                className="input"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy - Definitions</option>
                <option value="medium">Medium - Conceptual</option>
                <option value="hard">Hard - Scenario-based</option>
              </select>
            </div>

            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={handleStart}
              disabled={loading || !topic.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18 }} />{" "}
                  Starting...
                </>
              ) : (
                "Start Interview →"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── INTERVIEW SESSION ───
  return (
    <div className="interview-page has-navbar">
      <div className="container-sm">
        <div className="interview-header animate-fade-in">
          <div className="interview-meta">
            <span className="badge badge-primary">{topic}</span>
            <span className="badge badge-warning">Q{questionNumber}</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setStarted(false);
              setHistory([]);
              setFeedback(null);
            }}
          >
            End Interview
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="interview-history">
            {history.map((h, i) => (
              <div key={i} className="history-item card animate-fade-in-up">
                <div className="history-q">
                  <span className="history-label">Q{i + 1}:</span>
                  <span>{h.question.question}</span>
                </div>
                <div className="history-a">
                  <span className="history-label">Your answer:</span>
                  <span>{h.userAnswer}</span>
                </div>
                <div
                  className="history-eval"
                  style={{ color: getEvalColor(h.evaluation) }}
                >
                  {getEvalEmoji(h.evaluation)} {h.evaluation?.replace("_", " ")}
                </div>
                <p className="history-feedback">{h.feedback}</p>
              </div>
            ))}
          </div>
        )}

        {/* Current Question */}
        <div
          className="card question-card animate-slide-right"
          key={questionNumber}
        >
          <div className="question-number">Q{questionNumber}</div>
          <h3 className="question-text">{currentQuestion?.question}</h3>

          {currentQuestion?.options && (
            <div className="options-list">
              {currentQuestion.options.map((opt, i) => {
                const letter = opt.charAt(0);
                return (
                  <button
                    key={i}
                    className={`option-btn ${selectedAnswer === letter ? "selected" : ""}`}
                    onClick={() => !feedback && setSelectedAnswer(letter)}
                    disabled={!!feedback}
                  >
                    <span className="option-letter">{letter}</span>
                    <span className="option-text">
                      {opt.substring(2).trim()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Submit answer */}
          {!feedback && (
            <button
              className="btn btn-primary btn-block"
              onClick={handleAnswer}
              disabled={!selectedAnswer || loading}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18 }} />{" "}
                  Evaluating...
                </>
              ) : (
                "Submit Answer"
              )}
            </button>
          )}

          {/* Feedback */}
          {feedback && (
            <div className="feedback-section animate-fade-in-up">
              <div
                className="result-banner"
                style={{
                  background: `${getEvalColor(feedback.evaluation)}15`,
                  color: getEvalColor(feedback.evaluation),
                }}
              >
                <span className="result-emoji">
                  {getEvalEmoji(feedback.evaluation)}
                </span>
                <span className="result-text">
                  {feedback.evaluation?.replace("_", " ")}
                </span>
              </div>

              <div className="explanation-box">
                <div className="explanation-section">
                  <div className="exp-header">AI Feedback</div>
                  <p>{feedback.feedback}</p>
                </div>
              </div>

              {currentQuestion?.explanation && (
                <div className="explanation-box">
                  <div className="explanation-section">
                    <div className="exp-header">📖 Explanation</div>
                    <p>{currentQuestion.explanation}</p>
                  </div>
                  {currentQuestion?.interviewTip && (
                    <div className="explanation-section">
                      <div className="exp-header">🎯 Interview Tip</div>
                      <p>{currentQuestion.interviewTip}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                className="btn btn-primary btn-block"
                onClick={handleNextQuestion}
              >
                Next Follow-up Question →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
