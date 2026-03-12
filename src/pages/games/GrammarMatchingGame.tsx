import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGrammarPairs } from '@/hooks/useGrammarPairs';
import { useGameSounds } from '@/hooks/useGameSounds';
import { useRecordResult } from '@/hooks/useGameWords';
import { GameResults } from '@/components/GameResults';

const GrammarMatchingGame = () => {
  const navigate = useNavigate();
  const { pairs, loading } = useGrammarPairs(8);
  const { playCorrect, playWrong } = useGameSounds();
  const { saveSession } = useRecordResult();

  const [questions, setQuestions] = useState<{ id: string; text: string; gender: string; imageUrl: string | null }[]>([]);
  const [answers, setAnswers] = useState<{ id: string; text: string }[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (pairs.length === 0) return;
    setQuestions([...pairs].sort(() => Math.random() - 0.5).map(p => ({
      id: p.id, text: p.question, gender: p.voice_gender,
      imageUrl: p.question_image_url,
    })));
    setAnswers([...pairs].sort(() => Math.random() - 0.5).map(p => ({ id: p.id, text: p.answer })));
  }, [pairs]);

  const speak = useCallback((text: string, gender: string) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      gender === 'male' ? v.name.toLowerCase().includes('male') || v.name.includes('David')
        : v.name.toLowerCase().includes('female') || v.name.includes('Samantha') || v.name.includes('Zira')
    );
    if (preferred) u.voice = preferred;
    speechSynthesis.speak(u);
  }, []);

  const handleAnswerClick = useCallback((answerId: string) => {
    if (!selectedQuestion || matched.has(answerId)) return;
    if (selectedQuestion === answerId) {
      playCorrect();
      setMatched(prev => new Set([...prev, answerId]));
      setScore(s => s + 10);
      setSelectedQuestion(null);
      if (matched.size + 1 === pairs.length) setTimeout(() => setFinished(true), 600);
    } else {
      playWrong();
      setWrong(answerId);
      setMistakes(m => m + 1);
      setTimeout(() => { setWrong(null); setSelectedQuestion(null); }, 800);
    }
  }, [selectedQuestion, matched, pairs.length, playCorrect, playWrong]);

  const handleFinish = useCallback(async () => {
    await saveSession('grammar-matching', score, pairs.length, pairs.length - mistakes);
  }, [saveSession, score, pairs.length, mistakes]);

  useEffect(() => { if (finished) handleFinish(); }, [finished, handleFinish]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (pairs.length < 2) return <div className="text-center py-20"><p className="text-muted-foreground">Need at least 2 pairs.</p><Button onClick={() => navigate('/games')} className="mt-4 rounded-xl">Back</Button></div>;
  if (finished) return <GameResults score={score} total={pairs.length} correct={pairs.length - mistakes} gameType="grammar-matching" onPlayAgain={() => window.location.reload()} />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => navigate('/games')}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-2xl font-display font-bold text-foreground">Grammar Matching 🧩</h1>
        <span className="ml-auto text-sm font-bold text-primary">{score} pts</span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Audio + Image for Questions */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">🔊 Listen & Look</p>
          {questions.map((q, idx) => (
            <motion.button key={q.id} whileTap={{ scale: 0.97 }}
              onClick={() => { if (matched.has(q.id)) return; speak(q.text, q.gender); setSelectedQuestion(q.id); }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                matched.has(q.id) ? 'opacity-40 border-primary bg-primary/10' :
                selectedQuestion === q.id ? 'border-primary bg-primary/10 game-card-shadow' :
                'border-border bg-card hover:border-primary/50'
              }`}
              disabled={matched.has(q.id)}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                selectedQuestion === q.id ? 'bg-primary text-primary-foreground' : 'bg-primary/20 text-primary'
              }`}>
                <Play className="w-5 h-5" />
              </div>
              {/* Show question image if available */}
              {q.imageUrl && (
                <img src={q.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-border shrink-0" />
              )}
              <span className="font-semibold text-foreground text-sm">Audio {idx + 1}</span>
            </motion.button>
          ))}
        </div>
        {/* Right: Answer text */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">📝 Answers</p>
          {answers.map(a => (
            <motion.button key={a.id} whileTap={{ scale: 0.97 }}
              onClick={() => handleAnswerClick(a.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                matched.has(a.id) ? 'opacity-40 border-primary bg-primary/10' :
                wrong === a.id ? 'border-destructive bg-destructive/10 animate-shake' :
                'border-border bg-card hover:border-primary/50'
              }`}
              disabled={matched.has(a.id)}
            >
              <p className="font-semibold text-foreground text-sm">{a.text}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GrammarMatchingGame;
