import { useState, useEffect } from "react";
import { P, ff } from "./styles/theme";
import { useApp } from "./context/AppContext";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import MoodleConnect from "./pages/MoodleConnect";
import Dashboard from "./pages/Dashboard";
import CourseDetail from "./pages/CourseDetail";
import Career from "./pages/Career";
import Chat from "./pages/Chat";
import Planner from "./pages/Planner";
import Quiz from "./pages/Quiz";
import SettingsPage from "./pages/Settings";

export default function App() {
  const { user, moodleToken, selectedCourse, setSelectedCourse, loginWithGoogle, setGoogleTokens } = useApp();
  const [screen, setScreen] = useState("dashboard");
  const [quizCourse, setQuizCourse] = useState(null);

  // Check if we're on the OAuth callback
  const isCallback = window.location.pathname === "/auth/callback" || window.location.search.includes("code=");

  if (isCallback) {
    return (
      <AuthCallback
        onSuccess={(data) => {
          setGoogleTokens(data);
          loginWithGoogle(data.user);
        }}
        onError={() => window.location.href = "/"}
      />
    );
  }

  if (!user) {
    return (
      <Login onMockLogin={() => loginWithGoogle({ name: "Estudiante UCALP", email: "alumno@ucalpvirtual.edu.ar" })} />
    );
  }

  if (!moodleToken) return <MoodleConnect onConnected={() => setScreen("dashboard")} />;

  const navigate = (target) => {
    setScreen(target);
    setSelectedCourse(null);
    setQuizCourse(null);
  };

  const selectCourse = (course) => {
    setSelectedCourse(course);
    setScreen("course");
  };

  const navigateQuiz = (course) => {
    setQuizCourse(course);
    setScreen("quiz");
  };

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return <Dashboard onNavigate={navigate} onSelectCourse={selectCourse} />;
      case "course":
        return selectedCourse ? (
          <CourseDetail course={selectedCourse} onBack={() => { setSelectedCourse(null); setScreen("dashboard"); }}
            onNavigateChat={() => setScreen("chat")} onNavigateQuiz={navigateQuiz} />
        ) : <Dashboard onNavigate={navigate} onSelectCourse={selectCourse} />;
      case "chat": return <Chat />;
      case "career": return <Career />;
      case "planner": return <Planner />;
      case "quiz": return <Quiz initialCourse={quizCourse} />;
      case "settings": return <SettingsPage />;
      default: return <Dashboard onNavigate={navigate} onSelectCourse={selectCourse} />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: P.bg, fontFamily: ff.body }}>
      <Sidebar currentScreen={screen} onNavigate={navigate} />
      <main style={{ flex: 1, overflow: "auto", padding: "28px 32px" }}>
        {renderScreen()}
      </main>
    </div>
  );
}
