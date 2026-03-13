import {
  AlertTriangle,
  BarChart2,
  Brain,
  Camera,
  ClipboardList,
  FileText,
  Mic,
  Paperclip,
  Target,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  completeDocumentInterview,
  evaluateDocumentAnswer,
  generateDocumentQuestions,
  logDocumentAntiCheat,
  recordInterview,
  uploadInterviewDocument,
} from "../services/api";
import "./DocumentInterview.css";

// ── Word-diff helper ─────────────────────────────────────────────────────────
function WordDiff({ userAnswer, referenceAnswer }) {
  if (!userAnswer?.trim()) {
    return (
      <em className="wd-skipped">Question skipped — no answer recorded</em>
    );
  }
  const normalize = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
  const refSet = new Set(
    (referenceAnswer || "").split(/\s+/).map(normalize).filter(Boolean),
  );
  return (
    <span className="wd-text">
      {userAnswer
        .split(/\s+/)
        .filter(Boolean)
        .map((word, i) => {
          const nw = normalize(word);
          return (
            <span
              key={i}
              className={nw && refSet.has(nw) ? "wd-match" : "wd-miss"}
            >
              {word}{" "}
            </span>
          );
        })}
    </span>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const PHASE = {
  UPLOAD: "upload",
  PREVIEW: "preview",
  PREPARING: "preparing",
  INTERVIEW: "interview",
  EVALUATING: "evaluating",
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

export default function DocumentInterview() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [phase, setPhase] = useState(PHASE.UPLOAD);
  const userName = user?.displayName || "Guest";
  const [role, setRole] = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState("medium");
  const [totalQuestions, setTotalQuestions] = useState(8);
  const [timePerQuestion, setTimePerQuestion] = useState(120);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const [sessionId, setSessionId] = useState(null);
  const [docPreview, setDocPreview] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [responses, setResponses] = useState([]);
  const [results, setResults] = useState(null);

  const [timer, setTimer] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [tabSwitches, setTabSwitches] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [showWarning, setShowWarning] = useState(false);

  const [ttsEnabled, setTtsEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");

  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isRecordingRef = useRef(false);
  const handleStopAnswerRef = useRef(null);
  const transcriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const [pendingEval, setPendingEval] = useState(null);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      window.speechSynthesis?.cancel();
    };
  }, [cameraStream]);

  useEffect(() => {
    if (phase !== PHASE.INTERVIEW) return;

    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches((prev) => prev + 1);
        setWarnings((prev) => [
          ...prev,
          { type: "tab-switch", time: new Date().toLocaleTimeString() },
        ]);
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 3000);
        if (sessionId) {
          logDocumentAntiCheat({ sessionId, type: "tab-switch" }).catch(
            () => {},
          );
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, sessionId]);

  useEffect(() => {
    if (phase !== PHASE.INTERVIEW) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        setWarnings((prev) => [
          ...prev,
          { type: "fullscreen-exit", time: new Date().toLocaleTimeString() },
        ]);
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 3000);
        if (sessionId) {
          logDocumentAntiCheat({ sessionId, type: "fullscreen-exit" }).catch(
            () => {},
          );
        }
      } else {
        setIsFullscreen(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [phase, sessionId]);

  useEffect(() => {
    if (phase === PHASE.INTERVIEW && isRecording) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev >= timePerQuestion) {
            handleStopAnswerRef.current?.();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isRecording, timePerQuestion]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStream, phase]);

  const speakQuestion = useCallback(
    (text) => {
      if (!ttsEnabled || !text || !window.speechSynthesis) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.lang = "en-US";
      synth.speak(utterance);
    },
    [ttsEnabled],
  );

  useEffect(() => {
    if (phase === PHASE.INTERVIEW && questions[currentQ]?.question) {
      speakQuestion(questions[currentQ].question);
    }
  }, [phase, currentQ, questions, speakQuestion]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraError(null);
    } catch {
      setCameraError(
        "Camera access denied. Interview continues but anti-cheat visibility is reduced.",
      );
    }
  }, []);

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

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const value = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += `${value} `;
        } else {
          interim += value;
        }
      }

      if (final) {
        setTranscript((prev) => {
          const next = prev + final;
          transcriptRef.current = next;
          return next;
        });
      }
      interimTranscriptRef.current = interim;
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("Speech recognition error", event.error);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current && isRecordingRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // no-op
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (selected) => {
    const ext = selected.name.split(".").pop().toLowerCase();
    if (!["pdf", "doc", "docx"].includes(ext)) {
      setError("Only PDF, DOC, and DOCX files are supported.");
      return;
    }
    if (selected.size > 12 * 1024 * 1024) {
      setError("File too large. Maximum allowed size is 12MB.");
      return;
    }
    setFile(selected);
    setError("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files;
    if (dropped?.[0]) {
      validateAndSetFile(dropped[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please upload a valid question document.");
      return;
    }

    setLoading(true);
    setLoadingMsg("Parsing your interview document...");
    setError("");

    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("userName", userName.trim());
      formData.append("role", role);
      formData.append("difficulty", difficulty);
      formData.append("totalQuestions", totalQuestions);
      formData.append("timePerQuestion", timePerQuestion);

      const { data } = await uploadInterviewDocument(formData);
      setSessionId(data.sessionId);
      setDocPreview(data.parsed);
      setPhase(PHASE.PREVIEW);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to process document.");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handleStartInterview = async () => {
    setLoading(true);
    setLoadingMsg("Preparing your document-based interview...");
    setPhase(PHASE.PREPARING);

    try {
      const { data } = await generateDocumentQuestions({ sessionId });
      setQuestions(data.questions || []);
      setCurrentQ(0);
      setResponses([]);

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
      setPhase(PHASE.PREVIEW);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handleStartAnswer = () => {
    setError("");
    setInterimTranscript("");
    interimTranscriptRef.current = "";
    setTimer(0);
    isRecordingRef.current = true;
    setIsRecording(true);
    startSpeechRecognition();
  };

  const handleStopAnswer = async () => {
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

    const finalTranscript =
      `${transcriptRef.current} ${interimTranscriptRef.current}`.trim();
    setTranscript(finalTranscript);
    transcriptRef.current = finalTranscript;
    setInterimTranscript("");
    interimTranscriptRef.current = "";

    if (!hasMeaningfulAnswer(finalTranscript, difficulty)) {
      const minWords = getMinWordsByDifficulty(difficulty);
      setError(
        `No meaningful answer detected. Please provide at least ${minWords} word${minWords > 1 ? "s" : ""}.`,
      );
      setPhase(PHASE.INTERVIEW);
      return;
    }

    setPendingEval(null);
    setPhase(PHASE.EVALUATING);
    setLoadingMsg("Evaluating your response...");

    try {
      const { data } = await evaluateDocumentAnswer({
        sessionId,
        questionIndex: currentQ,
        transcript: finalTranscript,
        duration: timer,
      });

      const q = questions[currentQ] || {};
      const newResp = {
        questionIndex: currentQ,
        question: q.question,
        transcript: finalTranscript,
        evaluation: data.evaluation,
        referenceSource: data.referenceSource,
        referenceAnswer: data.referenceAnswer || "",
        duration: timer,
      };
      setResponses((prev) => [...prev, newResp]);
      setPendingEval(newResp);

      setTimeout(() => {
        setPendingEval(null);
        if (currentQ < questions.length - 1) {
          setCurrentQ((prev) => prev + 1);
          setTranscript("");
          transcriptRef.current = "";
          setInterimTranscript("");
          interimTranscriptRef.current = "";
          setTimer(0);
          setPhase(PHASE.INTERVIEW);
        } else {
          handleComplete();
        }
      }, 3200);
    } catch (err) {
      if (err.response?.status === 400) {
        setError(
          err.response?.data?.error || "Please provide a meaningful answer.",
        );
        setPhase(PHASE.INTERVIEW);
        return;
      }

      setError(
        err.response?.data?.error || "Evaluation failed for this answer.",
      );
      setTimeout(() => {
        if (currentQ < questions.length - 1) {
          setCurrentQ((prev) => prev + 1);
          setTranscript("");
          transcriptRef.current = "";
          setInterimTranscript("");
          interimTranscriptRef.current = "";
          setTimer(0);
          setPhase(PHASE.INTERVIEW);
        } else {
          handleComplete();
        }
      }, 1600);
    }
  };

  // Always point ref to the latest version to fix stale closure in timer
  handleStopAnswerRef.current = handleStopAnswer;

  const handleSkip = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    isRecordingRef.current = false;
    setIsRecording(false);

    setResponses((prev) => [
      ...prev,
      {
        questionIndex: currentQ,
        question: questions[currentQ]?.question,
        transcript: "",
        duration: 0,
        referenceAnswer: "",
        evaluation: {
          score: 0,
          relevance: 0,
          accuracy: 0,
          communicationClarity: 0,
          semanticSimilarity: 0,
          feedback: "Question skipped",
          strengths: [],
          missingKeyPoints: [],
          suggestions: [],
        },
      },
    ]);

    if (currentQ < questions.length - 1) {
      setCurrentQ((prev) => prev + 1);
      setTranscript("");
      transcriptRef.current = "";
      setInterimTranscript("");
      interimTranscriptRef.current = "";
      setTimer(0);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    window.speechSynthesis?.cancel();

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // no-op
      }
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }

    setPhase(PHASE.EVALUATING);
    setLoadingMsg("Generating final interview report...");

    try {
      const { data } = await completeDocumentInterview({ sessionId });
      setResults(data);
      setPhase(PHASE.RESULTS);

      if (user) {
        try {
          const xpRes = await recordInterview({ role, difficulty });
          updateUser(xpRes.data.user);
          toast.success(`+${xpRes.data.xpEarned} XP earned!`);
        } catch {
          // no-op
        }
      }
    } catch {
      setError("Failed to generate final report.");
      setPhase(PHASE.RESULTS);
    }
  };

  const formatTime = (sec) => {
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}:${rem.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "var(--success)";
    if (score >= 60) return "var(--warning)";
    return "var(--error)";
  };

  const getGradeColor = (grade) => {
    if (grade?.startsWith("A")) return "var(--success)";
    if (grade?.startsWith("B")) return "var(--primary)";
    if (grade?.startsWith("C")) return "var(--warning)";
    return "var(--error)";
  };

  const renderUpload = () => (
    <div className="ri-upload animate-fade-in-up">
      <div className="ri-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>
          ← Back
        </button>
        <h1>
          <FileText
            size={22}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 8,
            }}
          />
          Document Mock Interview
        </h1>
        <p className="ri-subtitle">
          Upload a PDF/DOC with interview questions. If answers are missing, AI
          generates reference answers automatically.
        </p>
      </div>

      <div className="ri-setup-grid">
        <div className="ri-config card">
          <h3>Interview Setup</h3>
          <div className="input-group">
            <label>Active User</label>
            <input className="input" type="text" value={userName} readOnly />
          </div>
          <div className="input-group">
            <label>Target Role</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option>Software Engineer</option>
              <option>Frontend Developer</option>
              <option>Backend Developer</option>
              <option>Full Stack Developer</option>
              <option>Data Scientist</option>
              <option>DevOps Engineer</option>
            </select>
          </div>
          <div className="ri-config-row">
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
            <div className="input-group">
              <label>Questions</label>
              <select
                className="input"
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(Number(e.target.value))}
              >
                <option value={5}>5 Questions</option>
                <option value={8}>8 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={12}>12 Questions</option>
              </select>
            </div>
          </div>
          <div className="input-group">
            <label>Time per Question</label>
            <select
              className="input"
              value={timePerQuestion}
              onChange={(e) => setTimePerQuestion(Number(e.target.value))}
            >
              <option value={60}>1 minute</option>
              <option value={90}>1.5 minutes</option>
              <option value={120}>2 minutes</option>
              <option value={180}>3 minutes</option>
            </select>
          </div>
        </div>

        <div className="ri-file-area card">
          <h3>Upload Question Document</h3>
          <div
            className={`ri-dropzone ${dragActive ? "active" : ""} ${file ? "has-file" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileSelect}
              hidden
            />
            {file ? (
              <div className="ri-file-info">
                <span className="ri-file-icon">
                  <FileText size={20} />
                </span>
                <span className="ri-file-name">{file.name}</span>
                <span className="ri-file-size">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <button
                  className="ri-file-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="ri-drop-content">
                <span className="ri-drop-icon">
                  <Paperclip size={28} />
                </span>
                <p>Drop your question/answer doc here</p>
                <span className="ri-drop-hint">PDF, DOC, DOCX · Max 12MB</span>
              </div>
            )}
          </div>

          <div className="ri-features-list">
            <div className="ri-feature-item">
              <Brain size={14} /> Deterministic question extraction from
              document
            </div>
            <div className="ri-feature-item">
              <Target size={14} /> AI fallback reference answer when no answer
              key exists
            </div>
            <div className="ri-feature-item">
              <Mic size={14} /> Real-time speech-to-text transcription
            </div>
            <div className="ri-feature-item">
              <Camera size={14} /> Camera-enabled interview environment
            </div>
            <div className="ri-feature-item">
              <BarChart2 size={14} /> Semantic answer evaluation and coaching
            </div>
          </div>
        </div>
      </div>

      {error && <div className="ri-error">{error}</div>}

      <button
        className="btn btn-primary btn-lg btn-block"
        onClick={handleUpload}
        disabled={!file || loading}
      >
        {loading ? (
          <>
            <span className="spinner" style={{ width: 20, height: 20 }} />
            {loadingMsg}
          </>
        ) : (
          "Upload & Parse Document →"
        )}
      </button>
    </div>
  );

  const renderPreview = () => (
    <div className="ri-preview animate-fade-in-up">
      <div className="ri-header">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setPhase(PHASE.UPLOAD)}
        >
          ← Back
        </button>
        <h1>
          <ClipboardList
            size={22}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 8,
            }}
          />
          Document Parsed Successfully
        </h1>
        <p className="ri-subtitle">
          Questions were extracted and structured. The interview will use
          provided answers where available, and generate AI references where
          needed.
        </p>
      </div>

      <div className="ri-preview-grid">
        <div className="ri-preview-card card">
          <h3>
            <FileText
              size={15}
              style={{
                display: "inline",
                verticalAlign: "middle",
                marginRight: 6,
              }}
            />
            Parsing Summary
          </h3>
          <p>Total questions found: {docPreview?.totalQuestionsFound || 0}</p>
          <p>Questions with answer key: {docPreview?.withAnswers || 0}</p>
          <p>Questions without answers: {docPreview?.withoutAnswers || 0}</p>
        </div>

        <div className="ri-preview-card card">
          <h3>
            <Target
              size={15}
              style={{
                display: "inline",
                verticalAlign: "middle",
                marginRight: 6,
              }}
            />
            Coverage
          </h3>
          <div className="ri-preview-name">
            {docPreview?.answerKeyCoverage || 0}% answer-key coverage
          </div>
          <p className="ri-preview-summary">
            Higher coverage gives stronger accuracy evaluation against provided
            references.
          </p>
        </div>

        <div className="ri-preview-card card">
          <h3>Sample Questions</h3>
          <ul>
            {(docPreview?.sampleQuestions || []).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <button
        className="btn btn-primary btn-lg btn-block"
        onClick={handleStartInterview}
      >
        {loading ? (
          <>
            <span className="spinner" style={{ width: 20, height: 20 }} />
            {loadingMsg}
          </>
        ) : (
          "Start Document Interview"
        )}
      </button>
    </div>
  );

  const renderPreparing = () => (
    <div className="loading-screen">
      <div className="spinner" />
      <h2>Preparing Interview Session</h2>
      <div className="loading-steps">
        <div className="loading-step done">
          <span className="step-icon">✓</span> Document parsed
        </div>
        <div className="loading-step active">
          <span className="step-icon" /> Structuring questions and references
        </div>
        <div className="loading-step">
          <span className="step-icon" /> Initializing camera, mic, and TTS
        </div>
      </div>
    </div>
  );

  const renderInterview = () => {
    const q = questions[currentQ] || {};
    const progress = (currentQ / Math.max(questions.length, 1)) * 100;
    const timerPercent = (timer / timePerQuestion) * 100;

    return (
      <div className="ri-interview">
        {showWarning && (
          <div className="ri-warning-overlay animate-fade-in">
            <div className="ri-warning-box">
              <span className="ri-warning-icon">
                <AlertTriangle size={30} />
              </span>
              <h3>Interview Integrity Warning</h3>
              <p>Tab switches and fullscreen exits are logged.</p>
            </div>
          </div>
        )}

        <div className="ri-topbar">
          <div className="ri-topbar-left">
            <span className="ri-q-counter">
              Q{currentQ + 1}/{questions.length}
            </span>
            <div className="ri-progress-bar">
              <div
                className="ri-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="ri-topbar-center">
            <span
              className={`di-ref-chip ${q.hasProvidedAnswer ? "provided" : "generated"}`}
            >
              {q.hasProvidedAnswer
                ? "Answer key available"
                : "AI reference mode"}
            </span>
          </div>
          <div className="ri-topbar-right">
            {tabSwitches > 0 && (
              <span className="ri-cheat-badge">
                ⚠️ {tabSwitches} tab switches
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

        <div className="ri-interview-body">
          <div className="ri-question-card card animate-slide-right">
            <div className="ri-question-text">{q.question}</div>
            <div className="di-inline-actions" style={{ marginTop: 12 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => speakQuestion(q.question)}
              >
                <Volume2 size={14} style={{ marginRight: 6 }} /> Replay Question
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
                {ttsEnabled ? (
                  <>
                    <VolumeOff size={14} style={{ marginRight: 6 }} /> Mute TTS
                  </>
                ) : (
                  <>
                    <Volume2 size={14} style={{ marginRight: 6 }} /> Enable TTS
                  </>
                )}
              </button>
            </div>
          </div>

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
                {isRecording && <span className="ri-rec-dot" />}
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
              <span>Live Transcript</span>
              {isRecording && (
                <span className="ri-listening-dot">🎤 Listening...</span>
              )}
            </div>
            <div className="ri-transcript-body">
              <textarea
                className="input ri-transcript-input"
                rows={5}
                placeholder={
                  isRecording
                    ? "Speaking... you can still edit your answer here."
                    : "Type answer here or click Start Recording and speak."
                }
                value={`${transcript}${interimTranscript ? ` ${interimTranscript}` : ""}`.trim()}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  transcriptRef.current = e.target.value;
                  setInterimTranscript("");
                  interimTranscriptRef.current = "";
                }}
              />
            </div>
          </div>

          <div className="ri-actions">
            {!isRecording && (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleStartAnswer}
              >
                🎤 Start Recording
              </button>
            )}
            <button
              className={`btn ${isRecording ? "btn-success" : "btn-outline"} btn-lg`}
              onClick={handleStopAnswer}
            >
              ✅ Submit Answer
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleSkip}>
              Skip Question →
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--error)" }}
              onClick={handleComplete}
            >
              End Interview
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEvaluating = () => {
    const showEval = pendingEval?.evaluation?.score !== undefined;

    return (
      <div className="loading-screen">
        {showEval ? (
          <div className="ri-eval-flash animate-scale-in">
            <div
              className="ri-eval-score"
              style={{ color: getScoreColor(pendingEval.evaluation.score) }}
            >
              {pendingEval.evaluation.score}
            </div>
            <p className="ri-eval-feedback">
              {pendingEval.evaluation.feedback}
            </p>
            <p className="di-suggestions">
              Missing points:{" "}
              {(pendingEval.evaluation.missingKeyPoints || [])
                .slice(0, 3)
                .join(", ") || "None"}
            </p>
          </div>
        ) : (
          <>
            <div className="spinner" />
            <h2>{loadingMsg || "Processing..."}</h2>
          </>
        )}
      </div>
    );
  };

  const renderResults = () => {
    const r = results?.results || {};

    return (
      <div className="ri-results animate-fade-in-up">
        <div className="ri-header">
          <h1>📊 Document Interview Report</h1>
          <p className="ri-subtitle">
            Detailed performance analysis based on semantic and communication
            quality.
          </p>
        </div>

        <div className="ri-results-hero card">
          <div
            className="ri-grade-circle"
            style={{ borderColor: getGradeColor(r.grade) }}
          >
            <span
              className="ri-grade-letter"
              style={{ color: getGradeColor(r.grade) }}
            >
              {r.grade || "N/A"}
            </span>
          </div>
          <div className="ri-results-hero-info">
            <h2>Overall Score: {r.overallScore || 0}/100</h2>
            <p>
              {r.interviewReady ? "✅ Interview Ready" : "⚡ Keep Practicing"}
            </p>
            <div className="ri-results-badges">
              <span className="badge badge-primary">{role}</span>
              <span className="badge badge-warning">{difficulty}</span>
              <span className="badge badge-success">
                {r.questionsAnswered || 0}/{questions.length} answered
              </span>
            </div>
          </div>
        </div>

        <div className="di-result-grid">
          <div className="di-mini-score">
            Relevance
            <strong style={{ color: getScoreColor(r.relevanceScore || 0) }}>
              {r.relevanceScore || 0}
            </strong>
          </div>
          <div className="di-mini-score">
            Accuracy
            <strong style={{ color: getScoreColor(r.accuracyScore || 0) }}>
              {r.accuracyScore || 0}
            </strong>
          </div>
          <div className="di-mini-score">
            Semantic Match
            <strong
              style={{ color: getScoreColor(r.semanticSimilarityScore || 0) }}
            >
              {r.semanticSimilarityScore || 0}
            </strong>
          </div>
          <div className="di-mini-score">
            Communication
            <strong style={{ color: getScoreColor(r.communicationScore || 0) }}>
              {r.communicationScore || 0}
            </strong>
          </div>
        </div>

        {r.summary && (
          <div className="ri-summary card">
            <h3>Interview Assessment</h3>
            <p>{r.summary}</p>
          </div>
        )}

        <div className="ri-feedback-grid">
          <div className="ri-feedback-card card">
            <h3>Top Strengths</h3>
            <ul>
              {(r.topStrengths || []).map((item, idx) => (
                <li key={idx} className="ri-feedback-item strength">
                  <span>✅</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="ri-feedback-card card">
            <h3>Areas to Improve</h3>
            <ul>
              {(r.areasToImprove || []).map((item, idx) => (
                <li key={idx} className="ri-feedback-item improve">
                  <span>🔸</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ri-question-results card">
          <h3>Per Question Feedback</h3>
          {(results?.responses || responses).map((item, idx) => (
            <div key={idx} className="ri-q-result">
              <div className="ri-q-result-header">
                <span className="ri-q-result-num">Q{idx + 1}</span>
                <span
                  className="ri-q-result-score"
                  style={{ color: getScoreColor(item.evaluation?.score || 0) }}
                >
                  {item.evaluation?.score || 0}/100
                </span>
              </div>
              <p className="ri-q-result-question">{item.question}</p>
              <div className="ri-q-result-transcript">
                <div className="wd-legend">
                  <span className="wd-legend-item">
                    <span className="wd-match">■</span> Matched
                  </span>
                  <span className="wd-legend-item">
                    <span className="wd-miss">■</span> Not in reference
                  </span>
                </div>
                <strong>Your answer: </strong>
                <WordDiff
                  userAnswer={item.transcript}
                  referenceAnswer={item.referenceAnswer || ""}
                />
              </div>
              {item.referenceAnswer && (
                <div className="wd-ref-answer">
                  <strong>Reference answer: </strong>
                  <span>{item.referenceAnswer}</span>
                </div>
              )}
              <p className="ri-q-result-feedback">
                {item.evaluation?.feedback}
              </p>
              <div className="di-inline-actions">
                <span className="di-ref-chip">
                  {item.referenceSource === "provided"
                    ? "Compared with provided answer"
                    : "Compared with AI reference answer"}
                </span>
                <span className="di-ref-chip">
                  Semantic similarity:{" "}
                  {item.evaluation?.semanticSimilarity || 0}%
                </span>
              </div>
              <div className="di-suggestions">
                <strong>Strengths:</strong>{" "}
                {(item.evaluation?.strengths || []).join("; ") || "-"}
              </div>
              <div className="di-suggestions">
                <strong>Missing key points:</strong>{" "}
                {(item.evaluation?.missingKeyPoints || []).join("; ") || "-"}
              </div>
              <div className="di-suggestions">
                <strong>Suggestions:</strong>{" "}
                {(item.evaluation?.suggestions || []).join("; ") || "-"}
              </div>
            </div>
          ))}
        </div>

        {results?.antiCheating && (
          <div className="ri-anticheat card">
            <h3>Integrity Report</h3>
            <div className="ri-anticheat-stats">
              <div className="ri-ac-stat">
                <span>Tab Switches</span>
                <strong
                  style={{
                    color:
                      results.antiCheating.tabSwitches > 0
                        ? "var(--error)"
                        : "var(--success)",
                  }}
                >
                  {results.antiCheating.tabSwitches}
                </strong>
              </div>
              <div className="ri-ac-stat">
                <span>Fullscreen Exits</span>
                <strong
                  style={{
                    color:
                      results.antiCheating.fullscreenExits > 0
                        ? "var(--error)"
                        : "var(--success)",
                  }}
                >
                  {results.antiCheating.fullscreenExits}
                </strong>
              </div>
            </div>
          </div>
        )}

        <div className="ri-result-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              setPhase(PHASE.UPLOAD);
              setSessionId(null);
              setDocPreview(null);
              setQuestions([]);
              setResponses([]);
              setResults(null);
              setFile(null);
              setTabSwitches(0);
              setWarnings([]);
            }}
          >
            New Interview
          </button>
          <button
            className="btn btn-outline btn-lg"
            onClick={() => navigate("/")}
          >
            ← Home
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="ri-page di-page has-navbar container">
      {phase === PHASE.UPLOAD && renderUpload()}
      {phase === PHASE.PREVIEW && renderPreview()}
      {phase === PHASE.PREPARING && renderPreparing()}
      {phase === PHASE.INTERVIEW && renderInterview()}
      {phase === PHASE.EVALUATING && renderEvaluating()}
      {phase === PHASE.RESULTS && renderResults()}
      {error && phase !== PHASE.UPLOAD && (
        <div className="ri-error">{error}</div>
      )}
      {warnings.length > 0 && phase === PHASE.INTERVIEW && (
        <div style={{ display: "none" }} aria-hidden="true">
          {warnings.length}
        </div>
      )}
    </div>
  );
}
