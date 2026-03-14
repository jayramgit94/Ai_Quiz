import {
  AlertTriangle,
  BarChart2,
  Brain,
  Briefcase,
  Camera,
  ClipboardList,
  Code,
  FileText,
  Layers,
  MessageCircle,
  Mic,
  Paperclip,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  completeInterview,
  evaluateAnswer,
  generateResumeQuestions,
  logAntiCheat,
  recordInterview,
  uploadResume,
} from "../services/api";
import "./ResumeInterview.css";

// ─── PHASES ───
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

function normalizeSpeechSegment(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function mergeUniqueTranscript(existing, incoming) {
  const previous = String(existing || "").trim();
  const addition = String(incoming || "").trim();
  if (!addition) return previous;
  if (!previous) return addition;

  const prevNorm = normalizeSpeechSegment(previous);
  const addNorm = normalizeSpeechSegment(addition);

  if (prevNorm.endsWith(addNorm) || prevNorm.includes(` ${addNorm} `)) {
    return previous;
  }
  if (addNorm.endsWith(prevNorm)) {
    return addition;
  }

  const prevWords = previous.split(/\s+/);
  const addWords = addition.split(/\s+/);
  const maxOverlap = Math.min(12, prevWords.length, addWords.length);
  let overlap = 0;

  for (let n = maxOverlap; n >= 1; n--) {
    const tail = prevWords.slice(-n).join(" ").toLowerCase();
    const head = addWords.slice(0, n).join(" ").toLowerCase();
    if (tail === head) {
      overlap = n;
      break;
    }
  }

  const merged = overlap
    ? `${previous} ${addWords.slice(overlap).join(" ")}`
    : `${previous} ${addition}`;
  return merged.replace(/\s+/g, " ").trim();
}

function compressSpeechArtifacts(text) {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (!words.length) return "";

  const result = [];
  let previous = "";
  let count = 0;

  for (const word of words) {
    const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalized && normalized === previous) {
      count += 1;
    } else {
      previous = normalized;
      count = 1;
    }
    if (count <= 2) result.push(word);
  }

  return result.join(" ").trim();
}

export default function ResumeInterview() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const toast = useToast();

  // ─── STATE ───
  const [phase, setPhase] = useState(PHASE.UPLOAD);
  const userName = user?.displayName || "Guest";
  const [role, setRole] = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState("medium");
  const [totalQuestions, setTotalQuestions] = useState(8);
  const [timePerQuestion, setTimePerQuestion] = useState(120);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Session
  const [sessionId, setSessionId] = useState(null);
  const [resumeData, setResumeData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [responses, setResponses] = useState([]);
  const [results, setResults] = useState(null);
  const [pendingEval, setPendingEval] = useState(null);

  // Interview
  const [timer, setTimer] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [permStatus, setPermStatus] = useState({ cam: null, mic: null });
  const [permChecking, setPermChecking] = useState(false);

  // Anti-cheat
  const [tabSwitches, setTabSwitches] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [showWarning, setShowWarning] = useState(false);

  // Loading/Error
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");

  // Refs
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isRecordingRef = useRef(false); // kept in sync with isRecording state to avoid stale closures
  const transcriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const lastFinalChunkRef = useRef("");
  const handleStopAnswerRef = useRef(null);

  // ═══════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    const mountedVideo = videoRef.current;

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      if (mountedVideo) {
        mountedVideo.srcObject = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [cameraStream]);

  // ═══════════════════════════════════════════════════
  // ANTI-CHEATING: Tab switch detection
  // ═══════════════════════════════════════════════════
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
        setTimeout(() => setShowWarning(false), 4000);

        if (sessionId) {
          logAntiCheat({ sessionId, type: "tab-switch" }).catch(() => {});
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, sessionId]);

  // ═══════════════════════════════════════════════════
  // ANTI-CHEATING: Fullscreen exit detection
  // ═══════════════════════════════════════════════════
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
        setTimeout(() => setShowWarning(false), 4000);

        if (sessionId) {
          logAntiCheat({ sessionId, type: "fullscreen-exit" }).catch(() => {});
        }
      } else {
        setIsFullscreen(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [phase, sessionId]);

  // ═══════════════════════════════════════════════════
  // TIMER
  // ═══════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════
  // CAMERA: assign srcObject after video element mounts
  // (startCamera runs during PREPARING phase before the
  //  <video> element exists, so we set it here reactively)
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, phase]);

  // ═══════════════════════════════════════════════════
  // CAMERA SETUP
  // ═══════════════════════════════════════════════════
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraError(null);
    } catch (err) {
      setCameraError(
        "Camera access denied. Interview will continue without video.",
      );
    }
  }, []);

  // ═══════════════════════════════════════════════════
  // SPEECH RECOGNITION SETUP
  // ═══════════════════════════════════════════════════
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition not supported. Use Chrome or Edge.");
      return false;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let finalCombined = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalCombined = mergeUniqueTranscript(finalCombined, t);
        } else {
          interim += t;
        }
      }

      const final = compressSpeechArtifacts(finalCombined);
      const normalizedFinal = normalizeSpeechSegment(final);
      if (final && normalizedFinal !== lastFinalChunkRef.current) {
        lastFinalChunkRef.current = normalizedFinal;
        setTranscript((prev) => {
          const merged = mergeUniqueTranscript(prev, final);
          const next = compressSpeechArtifacts(merged);
          transcriptRef.current = next;
          return next;
        });
      }
      interimTranscriptRef.current = interim;
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("Speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still recording — use ref to avoid stale closure
      if (recognitionRef.current && isRecordingRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // ignore
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, []);

  // ═══════════════════════════════════════════════════
  // FILE HANDLING
  // ═══════════════════════════════════════════════════
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files?.[0]) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f) => {
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext)) {
      setError("Only PDF and DOCX files are supported.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum 10MB.");
      return;
    }
    setFile(f);
    setError("");
  };

  // ═══════════════════════════════════════════════════
  // UPLOAD RESUME
  // ═══════════════════════════════════════════════════
  const handleUpload = async () => {
    if (!file) {
      setError("Please upload a resume.");
      return;
    }

    setLoading(true);
    setLoadingMsg("Uploading and parsing your resume...");
    setError("");

    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("userName", userName.trim());
      formData.append("role", role);
      formData.append("difficulty", difficulty);
      formData.append("totalQuestions", totalQuestions);
      formData.append("timePerQuestion", timePerQuestion);

      const { data } = await uploadResume(formData);
      setSessionId(data.sessionId);
      setResumeData(data.parsed);
      setPhase(PHASE.PREVIEW);
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to upload resume. Try again.",
      );
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // ═══════════════════════════════════════════════════
  // GENERATE QUESTIONS & START INTERVIEW
  // ═══════════════════════════════════════════════════
  const handleStartInterview = async () => {
    setLoading(true);
    setLoadingMsg("AI is crafting interview questions from your resume...");
    setPhase(PHASE.PREPARING);

    try {
      const { data } = await generateResumeQuestions({ sessionId });
      setQuestions(data.questions);
      setCurrentQ(0);
      setResponses([]);
      setPendingEval(null);

      // Start camera
      await startCamera();

      // Enter fullscreen
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        // Fullscreen not mandatory
      }

      setPhase(PHASE.INTERVIEW);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate questions.");
      setPhase(PHASE.PREVIEW);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // ═══════════════════════════════════════════════════
  // START ANSWERING
  // ═══════════════════════════════════════════════════
  const handleStartAnswer = () => {
    setError("");
    setInterimTranscript("");
    interimTranscriptRef.current = "";
    lastFinalChunkRef.current = "";
    setTimer(0);
    isRecordingRef.current = true;
    setIsRecording(true);
    startSpeechRecognition();
  };

  // ═══════════════════════════════════════════════════
  // STOP ANSWERING & EVALUATE
  // ═══════════════════════════════════════════════════
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

    const currentTranscript = compressSpeechArtifacts(
      mergeUniqueTranscript(
        transcriptRef.current,
        interimTranscriptRef.current,
      ),
    );
    setTranscript(currentTranscript);
    transcriptRef.current = currentTranscript;
    setInterimTranscript("");
    interimTranscriptRef.current = "";

    if (!hasMeaningfulAnswer(currentTranscript, difficulty)) {
      const minWords = getMinWordsByDifficulty(difficulty);
      setError(
        `No meaningful answer detected. Please provide at least ${minWords} word${minWords > 1 ? "s" : ""}.`,
      );
      setPhase(PHASE.INTERVIEW);
      return;
    }

    setPendingEval(null);
    setPhase(PHASE.EVALUATING);
    setLoadingMsg("AI is evaluating your answer...");

    try {
      const { data } = await evaluateAnswer({
        sessionId,
        questionIndex: currentQ,
        transcript: currentTranscript,
        duration: timer,
      });

      const newResp = {
        questionIndex: currentQ,
        question: questions[currentQ]?.question,
        category: questions[currentQ]?.category,
        transcript: currentTranscript,
        duration: timer,
        referenceSource: data.referenceSource,
        referenceAnswer: data.referenceAnswer || "",
        evaluation: data.evaluation,
      };

      setResponses((prev) => [...prev, newResp]);
      setPendingEval(newResp);

      // Auto-advance after showing evaluation
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
      }, 4200);
    } catch (err) {
      if (err.response?.status === 400) {
        setError(
          err.response?.data?.error || "Please provide a meaningful answer.",
        );
        setPhase(PHASE.INTERVIEW);
        return;
      }

      setError("Failed to evaluate answer. Moving to next question.");
      setResponses((prev) => [
        ...prev,
        {
          questionIndex: currentQ,
          question: questions[currentQ]?.question,
          category: questions[currentQ]?.category,
          transcript: currentTranscript,
          duration: timer,
          evaluation: { score: 0, feedback: "Evaluation failed" },
        },
      ]);
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
      }, 2000);
    }
  };

  handleStopAnswerRef.current = handleStopAnswer;

  // ═══════════════════════════════════════════════════
  // SKIP QUESTION
  // ═══════════════════════════════════════════════════
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
        category: questions[currentQ]?.category,
        transcript: "",
        duration: 0,
        evaluation: { score: 0, feedback: "Question skipped" },
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

  // ═══════════════════════════════════════════════════
  // COMPLETE INTERVIEW
  // ═══════════════════════════════════════════════════
  const handleComplete = async () => {
    // Exit fullscreen
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }

    // Stop camera
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setPhase(PHASE.EVALUATING);
    setLoadingMsg("Generating your interview report...");

    try {
      const { data } = await completeInterview({ sessionId });
      setResults(data);
      setPhase(PHASE.RESULTS);

      // Record interview for XP/achievements
      if (user) {
        try {
          const xpRes = await recordInterview({ role, difficulty });
          updateUser(xpRes.data.user);
          toast.success(`+${xpRes.data.xpEarned} XP earned!`);
          if (xpRes.data.newAchievements?.length) {
            xpRes.data.newAchievements.forEach((a) => {
              toast.achievement(`🏆 Achievement: ${a.name}`);
            });
          }
        } catch {
          // silent
        }
      }
    } catch (err) {
      setError("Failed to generate report.");
      setPhase(PHASE.RESULTS);
    }
  };

  // ═══════════════════════════════════════════════════
  // FORMAT HELPERS
  // ═══════════════════════════════════════════════════
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "var(--success)";
    if (score >= 60) return "var(--warning)";
    return "var(--error)";
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case "technical":
        return (
          <Code
            size={13}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 4,
            }}
          />
        );
      case "project":
        return (
          <Layers
            size={13}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 4,
            }}
          />
        );
      case "behavioral":
        return (
          <Users
            size={13}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 4,
            }}
          />
        );
      case "hr":
        return (
          <Briefcase
            size={13}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 4,
            }}
          />
        );
      default:
        return (
          <ClipboardList
            size={13}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 4,
            }}
          />
        );
    }
  };

  const getGradeColor = (grade) => {
    if (grade?.startsWith("A")) return "var(--success)";
    if (grade?.startsWith("B")) return "var(--primary)";
    if (grade?.startsWith("C")) return "var(--warning)";
    return "var(--error)";
  };

  // ═══════════════════════════════════════════════════
  // RENDER: UPLOAD PHASE
  // ═══════════════════════════════════════════════════
  const renderUpload = () => (
    <div className="ri-upload animate-fade-in-up">
      <div className="ri-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>
          ← Back
        </button>
        <h1>
          <Mic
            size={22}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 8,
            }}
          />
          AI Resume Interview
        </h1>
        <p className="ri-subtitle">
          Upload your resume and face AI-generated interview questions with live
          camera, speech-to-text, and real-time evaluation.
        </p>
      </div>

      <div className="ri-setup-grid">
        {/* Left: Config */}
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
              <option>Mobile Developer</option>
              <option>ML Engineer</option>
              <option>Cloud Architect</option>
              <option>Product Manager</option>
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
                <option value="easy">Easy (Entry Level)</option>
                <option value="medium">Medium (Mid Level)</option>
                <option value="hard">Hard (Senior Level)</option>
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
              <option value={300}>5 minutes</option>
            </select>
          </div>
        </div>

        {/* Right: File Upload */}
        <div className="ri-file-area card">
          <h3>Upload Resume</h3>
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
              accept=".pdf,.docx,.doc"
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
                <p>Drag & drop your resume here</p>
                <span className="ri-drop-hint">
                  or click to browse · PDF, DOCX · Max 10MB
                </span>
              </div>
            )}
          </div>

          <div className="ri-features-list">
            <div className="ri-feature-item">
              <Brain size={14} /> AI parses skills, projects & experience
            </div>
            <div className="ri-feature-item">
              <Target size={14} /> Questions tailored to YOUR resume
            </div>
            <div className="ri-feature-item">
              <Mic size={14} /> Live speech-to-text transcription
            </div>
            <div className="ri-feature-item">
              <Camera size={14} /> Camera monitoring (anti-cheat)
            </div>
            <div className="ri-feature-item">
              <BarChart2 size={14} /> AI-powered answer evaluation
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
          "Upload & Parse Resume →"
        )}
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: PREVIEW PHASE
  // ═══════════════════════════════════════════════════
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
          Resume Parsed Successfully
        </h1>
        <p className="ri-subtitle">
          AI has analyzed your resume. Review the extracted data below.
        </p>
      </div>

      <div className="ri-preview-grid">
        {/* Candidate Info */}
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
            Candidate
          </h3>
          <div className="ri-preview-name">{resumeData?.name || userName}</div>
          <p className="ri-preview-summary">{resumeData?.summary}</p>
        </div>

        {/* Skills */}
        <div className="ri-preview-card card">
          <h3>
            <Code
              size={15}
              style={{
                display: "inline",
                verticalAlign: "middle",
                marginRight: 6,
              }}
            />
            Skills & Technologies
          </h3>
          <div className="ri-tags">
            {[
              ...(resumeData?.skills || []),
              ...(resumeData?.technologies || []),
            ]
              .slice(0, 20)
              .map((s, i) => (
                <span key={i} className="ri-tag">
                  {s}
                </span>
              ))}
          </div>
        </div>

        {/* Projects */}
        <div className="ri-preview-card card">
          <h3>
            <Layers
              size={15}
              style={{
                display: "inline",
                verticalAlign: "middle",
                marginRight: 6,
              }}
            />
            Projects ({resumeData?.projectCount || 0})
          </h3>
          <p>Projects found and will be used to generate questions.</p>
        </div>

        {/* Experience */}
        <div className="ri-preview-card card">
          <h3>
            <Briefcase
              size={15}
              style={{
                display: "inline",
                verticalAlign: "middle",
                marginRight: 6,
              }}
            />
            Experience ({resumeData?.experienceCount || 0})
          </h3>
          <p>Work experiences found and will be referenced in questions.</p>
        </div>
      </div>

      <div className="ri-interview-config card">
        <h3>⚙️ Interview Configuration</h3>
        <div className="ri-config-summary">
          <span className="badge badge-primary">{role}</span>
          <span className="badge badge-warning">{difficulty}</span>
          <span className="badge badge-success">
            {totalQuestions} questions
          </span>
          <span className="badge badge-primary">
            {timePerQuestion}s per question
          </span>
        </div>
        <p style={{ marginTop: 12, fontSize: "0.9rem" }}>
          ⚠️ Once started, the interview enters fullscreen mode. Tab switches
          and fullscreen exits are monitored.
        </p>
      </div>

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
            ⚠️ Camera/mic is blocked. Allow it in your browser settings for the
            best experience. You can still continue without.
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
        onClick={handleStartInterview}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner" style={{ width: 20, height: 20 }} />
            {loadingMsg}
          </>
        ) : (
          "🎬 Start Interview"
        )}
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: PREPARING PHASE
  // ═══════════════════════════════════════════════════
  const renderPreparing = () => (
    <div className="loading-screen">
      <div className="spinner" />
      <h2>Preparing Your Interview</h2>
      <div className="loading-steps">
        <div className="loading-step done">
          <span className="step-icon">✓</span> Resume parsed
        </div>
        <div className="loading-step active">
          <span className="step-icon" /> Generating questions from your resume
        </div>
        <div className="loading-step">
          <span className="step-icon" /> Setting up camera & microphone
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: INTERVIEW PHASE
  // ═══════════════════════════════════════════════════
  const renderInterview = () => {
    const q = questions[currentQ];
    const progress = (currentQ / questions.length) * 100;
    const timerPercent = (timer / timePerQuestion) * 100;
    const timerDanger = timerPercent > 75;

    return (
      <div className="ri-interview">
        {/* Anti-cheat warning overlay */}
        {showWarning && (
          <div className="ri-warning-overlay animate-fade-in">
            <div className="ri-warning-box">
              <span className="ri-warning-icon">
                <AlertTriangle size={32} />
              </span>
              <h3>Warning Detected!</h3>
              <p>Tab switches and fullscreen exits are being recorded.</p>
              <p className="ri-warning-count">
                Total warnings:{" "}
                {tabSwitches +
                  warnings.filter((w) => w.type === "fullscreen-exit").length}
              </p>
            </div>
          </div>
        )}

        {/* Top bar */}
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
            <span className={`ri-category-badge ${q?.category}`}>
              {getCategoryIcon(q?.category)} {q?.category}
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
                onClick={() => {
                  document.documentElement.requestFullscreen().catch(() => {});
                }}
              >
                ⛶ Fullscreen
              </button>
            )}
          </div>
        </div>

        {/* Main interview area */}
        <div className="ri-interview-body">
          {/* Question */}
          <div className="ri-question-card card animate-slide-right">
            <div className="ri-question-text">{q?.question}</div>
            {q?.context && (
              <div className="ri-question-context">
                📌 Based on: {q.context}
              </div>
            )}
          </div>

          {/* Camera + Timer area */}
          <div className="ri-media-area">
            {/* Camera */}
            <div className="ri-camera-box">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="ri-camera-feed"
              />
              {cameraError && (
                <div className="ri-camera-error">
                  <span>📹</span> {cameraError}
                </div>
              )}
              <div className="ri-camera-label">
                {isRecording && <span className="ri-rec-dot" />}
                {isRecording ? "Recording" : "Camera"}
              </div>
            </div>

            {/* Timer */}
            <div className="ri-timer-box">
              <svg className="ri-timer-ring" viewBox="0 0 100 100">
                <circle className="ri-timer-bg" cx="50" cy="50" r="45" />
                <circle
                  className={`ri-timer-progress ${timerDanger ? "danger" : ""}`}
                  cx="50"
                  cy="50"
                  r="45"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - timerPercent / 100)}`}
                />
              </svg>
              <div className={`ri-timer-text ${timerDanger ? "danger" : ""}`}>
                {formatTime(timer)}
              </div>
              <div className="ri-timer-label">
                / {formatTime(timePerQuestion)}
              </div>
            </div>
          </div>

          {/* Transcript area */}
          <div className="ri-transcript-area card">
            <div className="ri-transcript-header">
              <span>📝 Live Transcript</span>
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
                value={`${transcript}${interimTranscript ? ` ${interimTranscript}` : ""}`}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  transcriptRef.current = e.target.value;
                  setInterimTranscript("");
                  interimTranscriptRef.current = "";
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
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

  // ═══════════════════════════════════════════════════
  // RENDER: EVALUATING PHASE
  // ═══════════════════════════════════════════════════
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
            <div
              className="di-inline-actions"
              style={{ justifyContent: "center" }}
            >
              <span className="di-ref-chip">
                Semantic: {pendingEval.evaluation?.semanticSimilarity || 0}%
              </span>
              <span className="di-ref-chip">
                Topic Coverage: {pendingEval.evaluation?.topicCoverage || 0}%
              </span>
            </div>
            <p className="di-suggestions">
              Matched terms:{" "}
              {(pendingEval.evaluation?.matchedKeyTerms || []).join(", ") ||
                "-"}
            </p>
            <p className="di-suggestions">
              Missing terms:{" "}
              {(pendingEval.evaluation?.missingKeyTerms || []).join(", ") ||
                "-"}
            </p>
            <p
              className="di-suggestions"
              style={{ maxWidth: 760, marginInline: "auto" }}
            >
              <strong>Reference:</strong>{" "}
              {pendingEval.referenceSource === "provided"
                ? "Document/expected answer"
                : "AI generated answer"}
            </p>
            <p
              className="di-suggestions"
              style={{ maxWidth: 760, marginInline: "auto" }}
            >
              <strong>Reference answer:</strong>{" "}
              {pendingEval.referenceAnswer || "Reference answer unavailable."}
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

  // ═══════════════════════════════════════════════════
  // RENDER: RESULTS PHASE
  // ═══════════════════════════════════════════════════
  const renderResults = () => {
    const r = results?.results || {};

    return (
      <div className="ri-results animate-fade-in-up">
        <div className="ri-header">
          <h1>📊 Interview Report</h1>
          <p className="ri-subtitle">
            Complete analysis of your mock interview performance
          </p>
        </div>

        {/* Grade + Score Hero */}
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

        {/* Score Breakdown */}
        <div className="ri-scores-grid">
          <div className="ri-score-card card">
            <span className="ri-score-icon">
              <Code size={22} />
            </span>
            <div
              className="ri-score-value"
              style={{ color: getScoreColor(r.technicalScore) }}
            >
              {r.technicalScore || 0}
            </div>
            <div className="ri-score-label">Technical</div>
            <div className="ri-score-bar">
              <div
                className="ri-score-bar-fill"
                style={{
                  width: `${r.technicalScore || 0}%`,
                  background: getScoreColor(r.technicalScore),
                }}
              />
            </div>
          </div>
          <div className="ri-score-card card">
            <span className="ri-score-icon">
              <MessageCircle size={22} />
            </span>
            <div
              className="ri-score-value"
              style={{ color: getScoreColor(r.communicationScore) }}
            >
              {r.communicationScore || 0}
            </div>
            <div className="ri-score-label">Communication</div>
            <div className="ri-score-bar">
              <div
                className="ri-score-bar-fill"
                style={{
                  width: `${r.communicationScore || 0}%`,
                  background: getScoreColor(r.communicationScore),
                }}
              />
            </div>
          </div>
          <div className="ri-score-card card">
            <span className="ri-score-icon">
              <TrendingUp size={22} />
            </span>
            <div
              className="ri-score-value"
              style={{ color: getScoreColor(r.confidenceScore) }}
            >
              {r.confidenceScore || 0}
            </div>
            <div className="ri-score-label">Confidence</div>
            <div className="ri-score-bar">
              <div
                className="ri-score-bar-fill"
                style={{
                  width: `${r.confidenceScore || 0}%`,
                  background: getScoreColor(r.confidenceScore),
                }}
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        {r.summary && (
          <div className="ri-summary card">
            <h3>📝 Interview Assessment</h3>
            <p>{r.summary}</p>
          </div>
        )}

        {/* Strengths & Improvements */}
        <div className="ri-feedback-grid">
          <div className="ri-feedback-card card">
            <h3>💪 Top Strengths</h3>
            <ul>
              {(r.topStrengths || []).map((s, i) => (
                <li key={i} className="ri-feedback-item strength">
                  <span>✅</span> {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="ri-feedback-card card">
            <h3>📈 Areas to Improve</h3>
            <ul>
              {(r.areasToImprove || []).map((s, i) => (
                <li key={i} className="ri-feedback-item improve">
                  <span>🔸</span> {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="ri-question-results card">
          <h3>📋 Question-by-Question Breakdown</h3>
          {(results?.responses || responses).map((r, i) => (
            <div key={i} className="ri-q-result">
              <div className="ri-q-result-header">
                <span className="ri-q-result-num">Q{i + 1}</span>
                <span className={`ri-category-badge ${r.category}`}>
                  {getCategoryIcon(r.category)} {r.category}
                </span>
                <span
                  className="ri-q-result-score"
                  style={{ color: getScoreColor(r.evaluation?.score) }}
                >
                  {r.evaluation?.score || 0}/100
                </span>
              </div>
              <p className="ri-q-result-question">{r.question}</p>
              {r.transcript && (
                <div className="ri-q-result-transcript">
                  <strong>Your answer:</strong> "{r.transcript}"
                </div>
              )}
              {r.referenceAnswer && (
                <div className="wd-ref-answer" style={{ marginBottom: 8 }}>
                  <strong>Reference answer:</strong> {r.referenceAnswer}
                </div>
              )}
              <div className="di-inline-actions" style={{ marginTop: 8 }}>
                <span className="di-ref-chip">
                  {r.referenceSource === "provided"
                    ? "Compared with expected answer"
                    : "Compared with AI reference"}
                </span>
                <span className="di-ref-chip">
                  Topic Coverage: {r.evaluation?.topicCoverage || 0}%
                </span>
                <span className="di-ref-chip">
                  Semantic: {r.evaluation?.semanticSimilarity || 0}%
                </span>
                <span className="di-ref-chip">
                  Matched Topics:{" "}
                  {(r.evaluation?.matchedTopics || []).join(", ") || "-"}
                </span>
                <span className="di-ref-chip">
                  Missing Topics:{" "}
                  {(r.evaluation?.missingTopics || []).join(", ") || "-"}
                </span>
                <span className="di-ref-chip">
                  Matched Terms:{" "}
                  {(r.evaluation?.matchedKeyTerms || []).join(", ") || "-"}
                </span>
                <span className="di-ref-chip">
                  Missing Terms:{" "}
                  {(r.evaluation?.missingKeyTerms || []).join(", ") || "-"}
                </span>
              </div>
              {r.evaluation?.feedback && (
                <p className="ri-q-result-feedback">{r.evaluation.feedback}</p>
              )}
            </div>
          ))}
        </div>

        {/* Anti-cheat report */}
        {results?.antiCheating && (
          <div className="ri-anticheat card">
            <h3>🛡️ Integrity Report</h3>
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

        {/* Actions */}
        <div className="ri-result-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              setPhase(PHASE.UPLOAD);
              setSessionId(null);
              setResumeData(null);
              setQuestions([]);
              setResponses([]);
              setPendingEval(null);
              setResults(null);
              setFile(null);
              setTabSwitches(0);
              setWarnings([]);
            }}
          >
            🔄 New Interview
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

  // ═══════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="ri-page has-navbar container">
      {phase === PHASE.UPLOAD && renderUpload()}
      {phase === PHASE.PREVIEW && renderPreview()}
      {phase === PHASE.PREPARING && renderPreparing()}
      {phase === PHASE.INTERVIEW && renderInterview()}
      {phase === PHASE.EVALUATING && renderEvaluating()}
      {phase === PHASE.RESULTS && renderResults()}
    </div>
  );
}
