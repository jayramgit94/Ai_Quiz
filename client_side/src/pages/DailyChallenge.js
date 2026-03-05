import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { addToLeaderboard, getDailyChallenge } from '../services/api';
import './DailyChallenge.css';

export default function DailyChallenge() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const [userName, setUserName] = useState(user?.displayName || '');
  const [nameSubmitted, setNameSubmitted] = useState(false);

  useEffect(() => {
    fetchChallenge();
    return () => clearInterval(timerRef.current);
  }, []);

  const fetchChallenge = async () => {
    try {
      const res = await getDailyChallenge();
      setChallenge(res.data);
    } catch (err) {
      console.error('Daily challenge fetch failed:', err);
    }
    setLoading(false);
  };

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const handleStartQuiz = () => {
    if (!userName.trim()) return;
    setNameSubmitted(true);
    startTimer();
  };

  const handleSelect = (letter) => {
    if (showResult) return;
    setSelectedAnswer(letter);
  };

  const handleConfirm = () => {
    if (!selectedAnswer) return;
    const q = challenge.questions[currentQ];
    const isCorrect = selectedAnswer === q.correctAnswer;

    const answerData = {
      questionIndex: currentQ,
      selectedAnswer,
      isCorrect,
      confidence: 'medium',
      timeTaken: timer,
    };

    setAnswers((prev) => [...prev, answerData]);
    setShowResult(true);
  };

  const handleNext = () => {
    if (currentQ + 1 >= challenge.questions.length) {
      clearInterval(timerRef.current);
      setFinished(true);
    } else {
      setCurrentQ((p) => p + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const accuracy = challenge ? Math.round((correctCount / challenge.questions.length) * 100) : 0;

  const handleSaveScore = async () => {
    try {
      await addToLeaderboard({
        userName,
        score: correctCount,
        accuracy,
        speedScore: Math.max(0, 100 - timer),
        finalScore: Math.round(accuracy * 0.7 + Math.max(0, 100 - timer) * 0.3),
        topic: challenge.topic,
        difficulty: challenge.difficulty,
        totalQuestions: challenge.questions.length,
      });
      navigate('/leaderboard');
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  // ─── LOADING ───
  if (loading) {
    return (
      <div className="daily-page has-navbar">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Loading today's challenge...</p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="daily-page has-navbar">
        <div className="container-sm">
          <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: '3rem' }}>
            <h2>⚠️ Couldn't load today's challenge</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Please try again later or check your connection.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── NAME ENTRY ───
  if (!nameSubmitted) {
    return (
      <div className="daily-page has-navbar">
        <div className="container-sm">
          <button className="btn btn-ghost btn-sm back-btn" onClick={() => navigate('/')}>← Back</button>
          <div className="card daily-intro animate-fade-in-up">
            <div className="daily-badge">🔥 Daily Challenge</div>
            <h2>{challenge.topic}</h2>
            <p className="daily-meta">
              <span className="badge badge-primary">{challenge.difficulty}</span>
              <span>{challenge.questions.length} questions</span>
              <span>{new Date().toLocaleDateString()}</span>
            </p>
            <p className="daily-desc">Everyone gets the same questions today. Complete the challenge and see how you rank on the leaderboard!</p>
            <div className="input-group">
              <label>Your Name</label>
              <input className="input" placeholder="Enter your name" value={userName} onChange={(e) => setUserName(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-lg btn-block" disabled={!userName.trim()} onClick={handleStartQuiz}>
              Start Challenge →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── FINISHED ───
  if (finished) {
    return (
      <div className="daily-page has-navbar">
        <div className="container-sm">
          <div className="card daily-results animate-fade-in-up">
            <div className="daily-badge">🏆 Challenge Complete!</div>
            <h2>{challenge.topic}</h2>

            <div className="results-grid">
              <div className="result-stat">
                <span className="stat-value">{correctCount}/{challenge.questions.length}</span>
                <span className="stat-label">Correct</span>
              </div>
              <div className="result-stat">
                <span className="stat-value">{accuracy}%</span>
                <span className="stat-label">Accuracy</span>
              </div>
              <div className="result-stat">
                <span className="stat-value">{timer}s</span>
                <span className="stat-label">Time</span>
              </div>
            </div>

            <div className="results-actions">
              <button className="btn btn-primary btn-lg" onClick={handleSaveScore}>
                Save & View Leaderboard
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/')}>
                Home
              </button>
            </div>

            {/* Review */}
            <div className="review-section">
              <h3>Question Review</h3>
              {challenge.questions.map((q, i) => {
                const ans = answers[i];
                return (
                  <div key={i} className={`review-item ${ans?.isCorrect ? 'correct' : 'incorrect'}`}>
                    <div className="review-q">
                      <span className="review-icon">{ans?.isCorrect ? '✅' : '❌'}</span>
                      <span>{q.question}</span>
                    </div>
                    <div className="review-detail">
                      <span>Your answer: <strong>{ans?.selectedAnswer}</strong></span>
                      <span>Correct: <strong>{q.correctAnswer}</strong></span>
                    </div>
                    {q.explanation && <p className="review-exp">{q.explanation}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── QUIZ ───
  const q = challenge.questions[currentQ];
  const isCorrect = showResult ? selectedAnswer === q.correctAnswer : null;

  return (
    <div className="daily-page">
      <div className="container-sm">
        <div className="quiz-top-bar animate-fade-in">
          <div className="quiz-info">
            <span className="badge badge-primary">🔥 Daily</span>
            <span className="badge badge-warning">{challenge.topic}</span>
          </div>
          <div className="quiz-timer">⏱️ {timer}s</div>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${((currentQ + 1) / challenge.questions.length) * 100}%` }} />
        </div>
        <div className="progress-label">
          Question {currentQ + 1} of {challenge.questions.length}
        </div>

        <div className="card question-card animate-slide-right" key={currentQ}>
          <h3 className="question-text">{q.question}</h3>

          <div className="options-list">
            {q.options.map((opt, i) => {
              const letter = opt.charAt(0);
              let cls = 'option-btn';
              if (selectedAnswer === letter) cls += ' selected';
              if (showResult) {
                if (letter === q.correctAnswer) cls += ' correct';
                else if (letter === selectedAnswer && !isCorrect) cls += ' incorrect';
              }
              return (
                <button key={i} className={cls} onClick={() => handleSelect(letter)} disabled={showResult}>
                  <span className="option-letter">{letter}</span>
                  <span className="option-text">{opt.substring(2).trim()}</span>
                </button>
              );
            })}
          </div>

          {!showResult && (
            <button className="btn btn-primary btn-block" onClick={handleConfirm} disabled={!selectedAnswer}>
              Confirm Answer
            </button>
          )}

          {showResult && (
            <div className="feedback-section animate-fade-in-up">
              <div className={`result-banner ${isCorrect ? 'banner-correct' : 'banner-incorrect'}`}>
                <span className="result-emoji">{isCorrect ? '🎉' : '😞'}</span>
                <span>{isCorrect ? 'Correct!' : 'Incorrect'}</span>
              </div>

              {q.explanation && (
                <div className="explanation-box">
                  <div className="explanation-section">
                    <div className="exp-header">📖 Explanation</div>
                    <p>{q.explanation}</p>
                  </div>
                  {q.example && (
                    <div className="explanation-section">
                      <div className="exp-header">💡 Example</div>
                      <p>{q.example}</p>
                    </div>
                  )}
                </div>
              )}

              <button className="btn btn-primary btn-block" onClick={handleNext}>
                {currentQ + 1 >= challenge.questions.length ? 'See Results' : 'Next Question →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
