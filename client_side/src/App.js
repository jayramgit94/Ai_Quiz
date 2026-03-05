import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import AchievementsPage from "./pages/AchievementsPage";
import AuthPage from "./pages/AuthPage";
import DailyChallenge from "./pages/DailyChallenge";
import DashboardPage from "./pages/DashboardPage";
import InterviewMode from "./pages/InterviewMode";
import LandingPage from "./pages/LandingPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import QuizScreen from "./pages/QuizScreen";
import QuizSetup from "./pages/QuizSetup";
import ResumeInterview from "./pages/ResumeInterview";
import ScoreScreen from "./pages/ScoreScreen";

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <div className="app">
            <Navbar />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/setup" element={<QuizSetup />} />
              <Route path="/quiz" element={<QuizScreen />} />
              <Route path="/score" element={<ScoreScreen />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/interview" element={<InterviewMode />} />
              <Route path="/daily" element={<DailyChallenge />} />
              <Route path="/resume-interview" element={<ResumeInterview />} />
              <Route path="/achievements" element={<AchievementsPage />} />
            </Routes>
          </div>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
