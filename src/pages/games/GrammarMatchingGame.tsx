import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
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

  const [questions, setQuestions] = useState<{ id: string; text: string; image?: string | null }[]>([]);
  const [answers, setAnswers] = useState<{ id: string; text: string; image?: string | null }[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (pairs.length === 0) return;
    setQuestions([...pairs].sort(() => Math.random() - 0.5).map(p => ({ id: p.id, text: p.question, image: p.question_image_url })));
    setAnswers([...pairs].sort(() => Math.random() - 0.5).map(p => ({ id: p.id, text: p.answer, image: p.answer_image_url })));
  }, [pairs]);

  const handleAnswerClick = useCallback((answerId: string) => {
    if (!selectedQuestion || matched.has(answerId)) return;
    if (selectedQuestion === answerId) {
      playCorrect();
      setMatched(prev => new Set([...prev, answerId]));
      setScore(s => s + 10);
      setSelectedQuestion(null);
      if (matched.size + 1 === pairs.length) {
        setTimeout(() => setFinished(true), 600);
      }
    } else {
      playWrong();
      setWrong(answerId);
      setMistakes(m => m + 1);
      setTimeout(() => { setWrong(null); setSelectedQuestion(null); }, 800);
    }
  }, [selectedQuestion, matched, pairs.length, playCorrect, playWrong]);

  const handleFinish = async () => {
    await saveSession('grammar-matching', score, pairs.length, pairs.length - mistakes);
    navigate('/games');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (pairs.length < 2) return <div className="text-center py-20"><p className="text-muted-foreground">Need at least 2 pairs.</p><Button onClick={() => navigate('/games')} className="mt-4 rounded-xl">Back</Button></div>;

  if (finished) return <GameResults score={score} total={pairs.length} correct={pairs.length - mistakes} onFinish={handleFinish} />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => navigate('/games')}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-2xl font-display font-bold text-foreground">Grammar Matching 🧩</h1>
        <span className="ml-auto text-sm font-bold text-primary">{score} pts</span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Questions</p>
          {questions.map(q => (
            <motion.button
              key={q.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => !matched.has(q.id) && setSelectedQuestion(q.id)}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                matched.has(q.id) ? 'opacity-40 border-primary bg-primary/10' :
                selectedQuestion === q.id ? 'border-primary bg-primary/10 game-card-shadow' :
                'border-border bg-card hover:border-primary/50'
              }`}
              disabled={matched.has(q.id)}
            >
              {q.image && <img src={q.image} alt="" className="w-full h-16 object-cover rounded-lg mb-2" />}
              <p className="font-semibold text-foreground text-sm">{q.text}</p>
            </motion.button>
          ))}
        </div>
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Answers</p>
          {answers.map(a => (
            <motion.button
              key={a.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleAnswerClick(a.id)}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                matched.has(a.id) ? 'opacity-40 border-primary bg-primary/10' :
                wrong === a.id ? 'border-destructive bg-destructive/10 animate-shake' :
                'border-border bg-card hover:border-primary/50'
              }`}
              disabled={matched.has(a.id)}
            >
              {a.image && <img src={a.image} alt="" className="w-full h-16 object-cover rounded-lg mb-2" />}
              <p className="font-semibold text-foreground text-sm">{a.text}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GrammarMatchingGame;
