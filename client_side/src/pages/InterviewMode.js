import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileText,
  MessageSquare,
  Mic,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  recordInterview,
  startInterview,
  submitInterviewAnswer,
} from "../services/api";
import "./InterviewMode.css";

const PHASE = {
  SETUP: "setup",
  INTERVIEW: "interview",
  RESULTS: "results",
};

function getMinWordsByDifficulty(level = "medium") {
  const difficultyLevel = String(level || "medium").toLowerCase();
  if (difficultyLevel === "easy") return 1;
  if (difficultyLevel === "hard") return 4;
  return 2;
}

function hasMeaningfulAnswer(text, level = "medium") {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.length >= getMinWordsByDifficulty(level);
}

export default function InterviewMode() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [phase, setPhase] = useState(PHASE.SETUP);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [timePerQuestion, setTimePerQuestion] = useState(120);
  const [maxQuestions, setMaxQuestions] = useState(6);

  const [sessionId, setSessionId] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [history, setHistory] = useState([]);
  const [reviewData, setReviewData] = useState(null);
  const [pendingNextQuestion, setPendingNextQuestion] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [answerText, setAnswerText] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);

  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [permStatus, setPermStatus] = useState({ cam: null, mic: null });
  const [permChecking, setPermChecking] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [showWarning, setShowWarning] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const isRecordingRef = useRef(false);
  const handleStopAnswerRef = useRef(null);
  const answerTextRef = useRef("");
  const interimTranscriptRef = useRef("");
  const profileRecordedRef = useRef(false);

  useEffect(() => {
    answerTextRef.current = answerText;
  }, [answerText]);

  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  const cleanupMedia = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    window.speechSynthesis?.cancel();
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  useEffect(() => {
    if (phase !== PHASE.RESULTS) return;
    cleanupMedia();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [phase, cleanupMedia]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStream, phase]);

  useEffect(() => {
    if (phase !== PHASE.INTERVIEW) return;

    const onVisibilityChange = () => {
      if (!document.hidden) return;
      const warning = {
        type: "tab-switch",
        time: new Date().toLocaleTimeString(),
      };
      setWarnings((prev) => [...prev, warning]);
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 2200);
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        const warning = {
          type: "fullscreen-exit",
          time: new Date().toLocaleTimeString(),
        };
        setWarnings((prev) => [...prev, warning]);
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 2200);
      } else {
        setIsFullscreen(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== PHASE.INTERVIEW || !isRecording) return;
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev >= timePerQuestion) {
          handleStopAnswerRef.current?.();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, isRecording, timePerQuestion]);

  const requestPermissions = useCallback(async () => {
    setPermChecking(true);
    let cam = "unknown";
    let mic = "unknown";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      cam = "granted";
      mic = "granted";
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic = "granted";
        s.getTracks().forEach((t) => t.stop());
      } catch {
        mic = "denied";
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        cam = "granted";
        s.getTracks().forEach((t) => t.stop());
      } catch {
        cam = "denied";
      }
    }
    setPermStatus({ cam, mic });
    setPermChecking(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      setCameraStream(stream);
      setCameraError("");
    } catch {
      setCameraError(
        "Camera access denied. Interview continues, but proctoring visibility is reduced.",
      );
    }
  }, []);

  const speakQuestion = useCallback(
    (text) => {
      if (!ttsEnabled || !text || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    },
    [ttsEnabled],
  );

  useEffect(() => {
    if (phase === PHASE.INTERVIEW && currentQuestion?.question) {
      speakQuestion(currentQuestion.question);
    }
  }, [phase, currentQuestion, speakQuestion]);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return false;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const value = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += `${value} `;
        } else {
          interim += value;
        }
      }

      if (final) {
        setAnswerText((prev) => {
          const next = `${prev} ${final}`.trim();
          answerTextRef.current = next;
          return next;
        });
      }
      interimTranscriptRef.current = interim;
      setInterimTranscript(interim);
    };

    recognition.onend = () => {
      if (isRecordingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // no-op
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.warn("speech recognition error", event.error);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, []);

  const handleStart = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await startInterview({
        topic: topic.trim(),
        difficulty,
      });

      setSessionId(res.data.sessionId || "");
      setCurrentQuestion(res.data.currentQuestion);
      setQuestionNumber(res.data.questionNumber || 1);
      setHistory([]);
      profileRecordedRef.current = false;
      setReviewData(null);
      setPendingNextQuestion(null);
      setWarnings([]);
      setAnswerText("");
      setInterimTranscript("");

      await startCamera();
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        // no-op
      }

      setPhase(PHASE.INTERVIEW);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to start interview.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartAnswer = () => {
    setError("");
    setInterimTranscript("");
    interimTranscriptRef.current = "";
    setTimer(0);
    setIsRecording(true);
    isRecordingRef.current = true;
    startSpeechRecognition();
  };

  const handleStopAnswer = async () => {
    const finalAnswer =
      `${answerTextRef.current} ${interimTranscriptRef.current}`.trim();

    isRecordingRef.current = false;
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setInterimTranscript("");
    interimTranscriptRef.current = "";

    if (!hasMeaningfulAnswer(finalAnswer, difficulty)) {
      const minWords = getMinWordsByDifficulty(difficulty);
      setError(
        `No meaningful answer detected. Please provide at least ${minWords} word${minWords > 1 ? "s" : ""}.`,
      );
      return;
    }

    setAnswerText(finalAnswer);
    answerTextRef.current = finalAnswer;

    setLoading(true);
    setError("");
    try {
      const res = await submitInterviewAnswer({
        sessionId,
        topic,
        difficulty,
        previousQuestion: currentQuestion?.question,
        userAnswer: finalAnswer,
        questionNumber,
        previousExpectedAnswer: currentQuestion?.expectedAnswer || "",
        previousExpectedTopics: currentQuestion?.expectedTopics || [],
      });

      const item = {
        questionNumber,
        question: currentQuestion?.question,
        userAnswer: finalAnswer,
        evaluation: res.data.evaluation,
        feedback: res.data.feedback,
        guidance: res.data.guidance || [],
        referenceAnswer: res.data.referenceAnswer || "",
        semanticSimilarity: res.data.semanticSimilarity || 0,
        topicCoverage: res.data.topicCoverage || 0,
        coveredTopics: res.data.coveredTopics || [],
        matchedKeyTerms: res.data.matchedKeyTerms || [],
        missingKeyTerms: res.data.missingKeyTerms || [],
        duration: timer,
      };

      setHistory((prev) => [...prev, item]);
      setReviewData(item);
      setPendingNextQuestion(res.data.followUpQuestion || null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to evaluate answer.");
    } finally {
      setLoading(false);
    }
  };

  handleStopAnswerRef.current = handleStopAnswer;

  const handleNextQuestion = () => {
    if (questionNumber >= maxQuestions || !pendingNextQuestion) {
      setPhase(PHASE.RESULTS);
      return;
    }

    setCurrentQuestion(pendingNextQuestion);
    setQuestionNumber((prev) => prev + 1);
    setAnswerText("");
    answerTextRef.current = "";
    setInterimTranscript("");
    interimTranscriptRef.current = "";
    setTimer(0);
    setReviewData(null);
    setPendingNextQuestion(null);
  };

  const handleEndInterview = async () => {
    cleanupMedia();
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // no-op
      }
    }
    setPhase(PHASE.RESULTS);
  };

  const avg = (field) => {
    if (!history.length) return 0;
    return Math.round(
      history.reduce((sum, h) => sum + (h.evaluation?.[field] || 0), 0) /
        history.length,
    );
  };

  const formatTime = (sec) => {
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}:${rem.toString().padStart(2, "0")}`;
  };

  const progress = (questionNumber / Math.max(maxQuestions, 1)) * 100;
  const timerPercent = (timer / Math.max(timePerQuestion, 1)) * 100;

  useEffect(() => {
    const syncToProfile = async () => {
      if (phase !== PHASE.RESULTS) return;
      if (!user || !history.length || profileRecordedRef.current) return;

      profileRecordedRef.current = true;
      try {
        const overall = avg("score");
        const res = await recordInterview({
          sessionId,
          interviewType: "live",
          role: `Live Topic: ${topic}`,
          difficulty,
          status: "completed",
          overallScore: overall,
          grade:
            overall >= 85
              ? "A"
              : overall >= 70
                ? "B"
                : overall >= 55
                  ? "C"
                  : "D",
          questionCount: history.length,
          durationSeconds: history.reduce(
            (sum, item) => sum + (item.duration || 0),
            0,
          ),
          completedAt: new Date().toISOString(),
          questionDetails: history.map((item, index) => ({
            questionIndex: index,
            question: item.question,
            transcript: item.userAnswer,
            referenceAnswer: item.referenceAnswer,
            evaluation: item.evaluation,
            duration: item.duration || 0,
          })),
        });
        updateUser(res.data.user);
      } catch {
        // no-op
      }
    };

    syncToProfile();
  }, [phase, user, history, sessionId, topic, difficulty, updateUser]);

  if (phase === PHASE.SETUP) {
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
              <span className="badge badge-primary">Live topic interview</span>
              <span className="setup-icon">
                <MessageSquare size={30} />
              </span>
              <h2>Interview Simulation</h2>
              <p>
                Topic + level based interview in live mode, with camera,
                speech-to-text, answer comparison, and AI guidance after each
                question.
              </p>
            </div>

            <div className="interview-shortcuts">
              <button
                className="interview-shortcut-card"
                onClick={() => navigate("/resume-interview")}
              >
                <Mic size={16} />
                <div>
                  <strong>Resume interview</strong>
                  <span>Practice from your uploaded resume</span>
                </div>
              </button>
              <button
                className="interview-shortcut-card"
                onClick={() => navigate("/document-interview")}
              >
                <FileText size={16} />
                <div>
                  <strong>Document interview</strong>
                  <span>Practice from uploaded Q&A files</span>
                </div>
              </button>
            </div>

            <div className="input-group">
              <label>Topic</label>
              <input
                className="input"
                placeholder="e.g. OOP, DBMS, System Design"
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
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="interview-config-grid">
              <div className="input-group">
                <label>Questions</label>
                <select
                  className="input"
                  value={maxQuestions}
                  onChange={(e) => setMaxQuestions(Number(e.target.value))}
                >
                  <option value={4}>4</option>
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                </select>
              </div>
              <div className="input-group">
                <label>Time / question</label>
                <select
                  className="input"
                  value={timePerQuestion}
                  onChange={(e) => setTimePerQuestion(Number(e.target.value))}
                >
                  <option value={90}>1.5 min</option>
                  <option value={120}>2 min</option>
                  <option value={180}>3 min</option>
                </select>
              </div>
            </div>

            {error && <div className="ri-error">{error}</div>}

            {/* ── Permission check ── */}
            <div className="perm-check-card">
              <div className="perm-check-row">
                <span className="perm-check-label">
                  📹 Camera:{" "}
                  <strong
                    style={{
                      color:
                        permStatus.cam === "granted"
                          ? "var(--success)"
                          : permStatus.cam === "denied"
                            ? "var(--error)"
                            : "var(--text-muted)",
                    }}
                  >
                    {permStatus.cam === "granted"
                      ? "Allowed ✓"
                      : permStatus.cam === "denied"
                        ? "Blocked ✗"
                        : "Not checked"}
                  </strong>
                </span>
                <span className="perm-check-label">
                  🎤 Microphone:{" "}
                  <strong
                    style={{
                      color:
                        permStatus.mic === "granted"
                          ? "var(--success)"
                          : permStatus.mic === "denied"
                            ? "var(--error)"
                            : "var(--text-muted)",
                    }}
                  >
                    {permStatus.mic === "granted"
                      ? "Allowed ✓"
                      : permStatus.mic === "denied"
                        ? "Blocked ✗"
                        : "Not checked"}
                  </strong>
                </span>
              </div>
              {(permStatus.cam === "denied" || permStatus.mic === "denied") && (
                <p className="perm-check-warn">
                  ⚠️ Please allow camera/mic in your browser settings for the
                  best experience. You can still continue without them.
                </p>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={requestPermissions}
                disabled={permChecking}
                type="button"
              >
                {permChecking ? "Checking..." : "🔐 Check / Allow Camera & Mic"}
              </button>
            </div>

            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={handleStart}
              disabled={loading || !topic.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18 }} />
                  Starting...
                </>
              ) : (
                "Start Live Interview →"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === PHASE.RESULTS) {
    return (
      <div className="interview-page has-navbar">
        <div className="container-sm">
          <div className="card animate-fade-in-up">
            <h2 style={{ marginBottom: 10 }}>Interview Summary</h2>
            <p style={{ marginBottom: 16 }}>
              Topic: <strong>{topic}</strong> · Difficulty:{" "}
              <strong>{difficulty}</strong>
            </p>

            <div className="di-result-grid" style={{ marginBottom: 16 }}>
              <div className="di-mini-score">
                Overall
                <strong>{avg("score")}</strong>
              </div>
              <div className="di-mini-score">
                Relevance
                <strong>{avg("relevance")}</strong>
              </div>
              <div className="di-mini-score">
                Depth
                <strong>{avg("depth")}</strong>
              </div>
              <div className="di-mini-score">
                Communication
                <strong>{avg("communication")}</strong>
              </div>
            </div>

            <div className="interview-history">
              {history.map((item, idx) => (
                <div key={idx} className="history-item card animate-fade-in-up">
                  <div className="history-q">
                    <span className="history-label">
                      Q{item.questionNumber}:
                    </span>
                    <span>{item.question}</span>
                  </div>
                  <div className="history-a">
                    <span className="history-label">Your answer:</span>
                    <span>{item.userAnswer}</span>
                  </div>
                  <div className="di-inline-actions" style={{ marginTop: 8 }}>
                    <span className="di-ref-chip">
                      Semantic: {item.semanticSimilarity}%
                    </span>
                    <span className="di-ref-chip">
                      Matched: {item.matchedKeyTerms?.join(", ") || "-"}
                    </span>
                  </div>
                  <p className="history-feedback" style={{ marginTop: 8 }}>
                    {item.feedback}
                  </p>
                </div>
              ))}
            </div>

            <div className="ri-actions" style={{ marginTop: 12 }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setPhase(PHASE.SETUP);
                  setSessionId("");
                  setCurrentQuestion(null);
                  setQuestionNumber(1);
                  setHistory([]);
                  setWarnings([]);
                  setError("");
                }}
              >
                New Interview
              </button>
              <button className="btn btn-outline" onClick={() => navigate("/")}>
                ← Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="interview-page has-navbar">
      {showWarning && (
        <div className="ri-warning-overlay animate-fade-in">
          <div className="ri-warning-box">
            <span className="ri-warning-icon">
              <AlertTriangle size={30} />
            </span>
            <h3>Interview Integrity Warning</h3>
            <p>Tab switches and fullscreen exits are detected.</p>
          </div>
        </div>
      )}

      <div className="container-sm">
        <div className="ri-topbar">
          <div className="ri-topbar-left">
            <span className="ri-q-counter">
              Q{questionNumber}/{maxQuestions}
            </span>
            <div className="ri-progress-bar">
              <div
                className="ri-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="ri-topbar-right">
            {warnings.length > 0 && (
              <span className="ri-cheat-badge">
                ⚠ {warnings.length} warnings
              </span>
            )}
            {!isFullscreen && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  document.documentElement.requestFullscreen().catch(() => {})
                }
              >
                ⛶ Fullscreen
              </button>
            )}
          </div>
        </div>

        <div className="card question-card animate-slide-right">
          <div className="question-number">Q{questionNumber}</div>
          <h3 className="question-text">{currentQuestion?.question}</h3>
          <p className="history-feedback" style={{ marginBottom: 10 }}>
            Tip:{" "}
            {currentQuestion?.interviewTip ||
              "Keep your answer structured and concise."}
          </p>

          <div className="ri-media-area">
            <div className="ri-camera-box">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="ri-camera-feed"
              />
              {cameraError && (
                <div className="ri-camera-error">📹 {cameraError}</div>
              )}
              <div className="ri-camera-label">
                <Camera size={14} style={{ marginRight: 6 }} />
                {isRecording ? "Recording" : "Camera"}
              </div>
            </div>

            <div className="ri-timer-box">
              <svg className="ri-timer-ring" viewBox="0 0 100 100">
                <circle className="ri-timer-bg" cx="50" cy="50" r="45" />
                <circle
                  className={`ri-timer-progress ${timerPercent > 75 ? "danger" : ""}`}
                  cx="50"
                  cy="50"
                  r="45"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - timerPercent / 100)}`}
                />
              </svg>
              <div
                className={`ri-timer-text ${timerPercent > 75 ? "danger" : ""}`}
              >
                {formatTime(timer)}
              </div>
              <div className="ri-timer-label">
                / {formatTime(timePerQuestion)}
              </div>
            </div>
          </div>

          <div className="ri-transcript-area card">
            <div className="ri-transcript-header">
              <span>Live Answer</span>
              <div className="di-inline-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => speakQuestion(currentQuestion?.question || "")}
                >
                  <Volume2 size={14} /> Replay
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setTtsEnabled((prev) => {
                      const next = !prev;
                      if (!next) window.speechSynthesis?.cancel();
                      return next;
                    });
                  }}
                >
                  {ttsEnabled ? <VolumeOff size={14} /> : <Volume2 size={14} />}{" "}
                  {ttsEnabled ? "Mute TTS" : "Enable TTS"}
                </button>
              </div>
            </div>

            <textarea
              className="input interview-answer-input"
              rows={6}
              placeholder="Speak or type your answer here..."
              value={`${answerText}${interimTranscript ? ` ${interimTranscript}` : ""}`}
              onChange={(e) => {
                setAnswerText(e.target.value);
                answerTextRef.current = e.target.value;
                setInterimTranscript("");
                interimTranscriptRef.current = "";
              }}
              disabled={Boolean(reviewData)}
            />
          </div>

          {!reviewData && (
            <div className="ri-actions">
              {!isRecording && (
                <button className="btn btn-primary" onClick={handleStartAnswer}>
                  🎤 Start Recording
                </button>
              )}
              <button
                className={`btn ${isRecording ? "btn-success" : "btn-outline"}`}
                onClick={handleStopAnswer}
              >
                ✅ Submit Answer
              </button>
              <button className="btn btn-outline" onClick={handleEndInterview}>
                End Interview
              </button>
            </div>
          )}

          {loading && (
            <div className="loading-screen" style={{ minHeight: 120 }}>
              <div className="spinner" />
              <h3>Evaluating your response...</h3>
            </div>
          )}

          {error && <div className="ri-error">{error}</div>}

          {reviewData && (
            <div className="feedback-section animate-fade-in-up">
              <div
                className="result-banner"
                style={{
                  background: "rgba(31,169,113,0.12)",
                  color: "var(--success)",
                }}
              >
                <CheckCircle2 size={16} />
                <span className="result-text">
                  Score: {reviewData.evaluation?.score || 0}/100
                </span>
              </div>

              <div className="di-result-grid" style={{ marginBottom: 12 }}>
                <div className="di-mini-score">
                  Relevance
                  <strong>{reviewData.evaluation?.relevance || 0}</strong>
                </div>
                <div className="di-mini-score">
                  Depth<strong>{reviewData.evaluation?.depth || 0}</strong>
                </div>
                <div className="di-mini-score">
                  Communication
                  <strong>{reviewData.evaluation?.communication || 0}</strong>
                </div>
                <div className="di-mini-score">
                  Semantic<strong>{reviewData.semanticSimilarity || 0}</strong>
                </div>
                <div className="di-mini-score">
                  Topic Coverage
                  <strong>{reviewData.topicCoverage || 0}%</strong>
                </div>
              </div>

              <div className="explanation-box">
                <div className="exp-header">AI Feedback</div>
                <p>{reviewData.feedback}</p>
              </div>

              <div className="explanation-box">
                <div className="exp-header">Reference Answer</div>
                <p>
                  {reviewData.referenceAnswer ||
                    "Reference answer unavailable."}
                </p>
              </div>

              <div className="di-inline-actions" style={{ marginBottom: 8 }}>
                <span className="di-ref-chip provided">
                  Matched: {reviewData.matchedKeyTerms?.join(", ") || "-"}
                </span>
                <span className="di-ref-chip generated">
                  Missing: {reviewData.missingKeyTerms?.join(", ") || "-"}
                </span>
                <span className="di-ref-chip">
                  Covered Topics: {reviewData.coveredTopics?.join(", ") || "-"}
                </span>
              </div>

              <div className="explanation-box">
                <div className="exp-header">Guidance for next question</div>
                <ul className="interview-guidance-list">
                  {(reviewData.guidance || []).map((g, idx) => (
                    <li key={idx}>{g}</li>
                  ))}
                </ul>
              </div>

              <button
                className="btn btn-primary btn-block"
                onClick={handleNextQuestion}
              >
                {questionNumber >= maxQuestions
                  ? "Finish Interview →"
                  : "Next Question →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
