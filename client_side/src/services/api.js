import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
  headers: { "Content-Type": "application/json" },
});

// ─── AUTH INTERCEPTOR ───
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRedirecting = false;
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !isRedirecting) {
      isRedirecting = true;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (
        !window.location.pathname.includes("/login") &&
        !window.location.pathname.includes("/register")
      ) {
        window.location.href = "/login";
      }
      // Reset flag after redirect completes
      setTimeout(() => {
        isRedirecting = false;
      }, 2000);
    }
    return Promise.reject(err);
  },
);

// ─── AUTH ───
export const registerUser = (data) => api.post("/auth/register", data);
export const loginUser = (data) => api.post("/auth/login", data);
export const getMe = () => api.get("/auth/me");
export const updateProfile = (data) => api.put("/auth/profile", data);
export const recordQuiz = (data) => api.post("/auth/record-quiz", data);
export const recordInterview = (data) =>
  api.post("/auth/record-interview", data);
export const getUserLeaderboard = () => api.get("/auth/leaderboard");
export const clearUserData = () => api.delete("/auth/clear-data");

// ─── QUIZ ───
export const generateQuiz = (data) => api.post("/quiz/generate", data);
export const submitQuiz = (data) => api.post("/quiz/submit", data);
export const getSession = (sessionId) => api.get(`/quiz/session/${sessionId}`);
export const expandTopic = (keyword) =>
  api.post("/quiz/expand-topic", { keyword });

// ─── INTERVIEW ───
export const startInterview = (data) => api.post("/interview/start", data);
export const submitInterviewAnswer = (data) =>
  api.post("/interview/answer", data);

// ─── LEADERBOARD ───
export const addToLeaderboard = (data) => api.post("/leaderboard/add", data);
export const getTodayLeaderboard = () => api.get("/leaderboard/today");
export const getAllLeaderboard = () => api.get("/leaderboard/all");
export const getTopicLeaderboard = (topic) =>
  api.get(`/leaderboard/topic/${encodeURIComponent(topic)}`);

// ─── DASHBOARD ───
export const getUserProgress = (userName) =>
  api.get(`/leaderboard/progress/${encodeURIComponent(userName)}`);

// ─── DAILY CHALLENGE ───
export const getDailyChallenge = () => api.get("/leaderboard/daily-challenge");

// ─── RESUME INTERVIEW ───
export const uploadResume = (formData) =>
  api.post("/resume-interview/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 180000,
  });

export const generateResumeQuestions = (data) =>
  api.post("/resume-interview/generate-questions", data, { timeout: 180000 });

export const evaluateAnswer = (data) =>
  api.post("/resume-interview/evaluate-answer", data, { timeout: 120000 });

export const logAntiCheat = (data) =>
  api.post("/resume-interview/anti-cheat", data);

export const completeInterview = (data) =>
  api.post("/resume-interview/complete", data, { timeout: 180000 });

export const getResumeSession = (sessionId) =>
  api.get(`/resume-interview/session/${sessionId}`);

export const getInterviewHistory = (userName) =>
  api.get(`/resume-interview/history/${encodeURIComponent(userName)}`);

// ─── DOCUMENT INTERVIEW ───
export const uploadInterviewDocument = (formData) =>
  api.post("/document-interview/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 180000,
  });

export const generateDocumentQuestions = (data) =>
  api.post("/document-interview/generate-questions", data, {
    timeout: 180000,
  });

export const evaluateDocumentAnswer = (data) =>
  api.post("/document-interview/evaluate-answer", data, { timeout: 120000 });

export const logDocumentAntiCheat = (data) =>
  api.post("/document-interview/anti-cheat", data);

export const completeDocumentInterview = (data) =>
  api.post("/document-interview/complete", data, { timeout: 180000 });

export const getDocumentInterviewSession = (sessionId) =>
  api.get(`/document-interview/session/${sessionId}`);

export const getDocumentInterviewHistory = (userName) =>
  api.get(`/document-interview/history/${encodeURIComponent(userName)}`);

export default api;
