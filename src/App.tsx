import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import ManageWords from "./pages/ManageWords";
import ManageGrammar from "./pages/ManageGrammar";
import GameCenter from "./pages/GameCenter";
import Progress from "./pages/Progress";
import FlashcardsGame from "./pages/games/FlashcardsGame";
import MultipleChoiceGame from "./pages/games/MultipleChoiceGame";
import MatchingGame from "./pages/games/MatchingGame";
import FillBlanksGame from "./pages/games/FillBlanksGame";
import WordScrambleGame from "./pages/games/WordScrambleGame";
import MemoryMatchGame from "./pages/games/MemoryMatchGame";
import WordShooterGame from "./pages/games/WordShooterGame";
import PictureDictationGame from "./pages/games/PictureDictationGame";
import WoodpeckerGame from "./pages/games/WoodpeckerGame";
import VoiceMasterGame from "./pages/games/VoiceMasterGame";
import LuckyVoiceGame from "./pages/games/LuckyVoiceGame";
import MoleWhackerGame from "./pages/games/MoleWhackerGame";
import GrammarMatchingGame from "./pages/games/GrammarMatchingGame";
import GrammarDictationGame from "./pages/games/GrammarDictationGame";
import QuizMasterGame from "./pages/games/QuizMasterGame";
import SentenceScrambleGame from "./pages/games/SentenceScrambleGame";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/" element={<ProtectedRoute><ManageWords /></ProtectedRoute>} />
    <Route path="/games" element={<ProtectedRoute><GameCenter /></ProtectedRoute>} />
    <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
    <Route path="/play/flashcards" element={<ProtectedRoute><FlashcardsGame /></ProtectedRoute>} />
    <Route path="/play/multiple-choice" element={<ProtectedRoute><MultipleChoiceGame /></ProtectedRoute>} />
    <Route path="/play/matching" element={<ProtectedRoute><MatchingGame /></ProtectedRoute>} />
    <Route path="/play/fill-blanks" element={<ProtectedRoute><FillBlanksGame /></ProtectedRoute>} />
    <Route path="/play/word-scramble" element={<ProtectedRoute><WordScrambleGame /></ProtectedRoute>} />
    <Route path="/play/memory-match" element={<ProtectedRoute><MemoryMatchGame /></ProtectedRoute>} />
    <Route path="/play/word-shooter" element={<ProtectedRoute><WordShooterGame /></ProtectedRoute>} />
    <Route path="/play/picture-dictation" element={<ProtectedRoute><PictureDictationGame /></ProtectedRoute>} />
    <Route path="/play/woodpecker" element={<ProtectedRoute><WoodpeckerGame /></ProtectedRoute>} />
    <Route path="/play/voice-master" element={<ProtectedRoute><VoiceMasterGame /></ProtectedRoute>} />
    <Route path="/play/lucky-voice" element={<ProtectedRoute><LuckyVoiceGame /></ProtectedRoute>} />
    <Route path="/play/mole-whacker" element={<ProtectedRoute><MoleWhackerGame /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
