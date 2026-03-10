import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGrammarPairs } from '@/hooks/useGrammarPairs';
import { useGameSounds } from '@/hooks/useGameSounds';
import { useRecordResult } from '@/hooks/useGameWords';
import GameResults from '@/components/GameResults';

const GrammarDictationGame = () => {
  const navigate = useNavigate();
  const { pairs, loading } = useGrammarPairs(10);
  const { playCorrect, playWrong } = useGameSounds();
  const { saveSession } = useRecordResult();

  const [round, setRound] = useState(0);
  const [items, setItems] = useState<{ text: string; gender: string }[]>([]);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (pairs.length === 0) return;
    // Randomly pick question or answer from each pair
    const arr = pairs.map(p => {
      const useQuestion = Math.random() > 0.5;
      return { text: useQuestion ? p.question : p.answer, gender: p.voice_gender };
    });
    setItems(arr);
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

  useEffect(() => {
    if (items.length > 0 && round < items.length && !finished) {
      const t = setTimeout(() => speak(items[round].text, items[round].gender), 500);
      return () => clearTimeout(t);
    }
  }, [round, items, finished, speak]);

  const submit = () => {
    if (!input.trim() || showAnswer) return;
    const target = items[round].text;
    const isCorrect = input.trim().toLowerCase() === target.toLowerCase();
    setLastCorrect(isCorrect);
    setShowAnswer(true);
    if (isCorrect) {
      playCorrect();
      setScore(s => s + 10);
      setCorrect(c => c + 1);
    } else {
      playWrong();
    }
  };

  const next = () => {
    if (round + 1 >= items.length) {
      setFinished(true);
    } else {
      setRound(r => r + 1);
      setInput('');
      setShowAnswer(false);
      setLastCorrect(null);
    }
  };

  const handleFinish = async () => {
    await saveSession('grammar-dictation', score, items.length, correct);
    navigate('/games');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (items.length < 1) return <div className="text-center py-20"><p className="text-muted-foreground">Need at least 1 pair.</p><Button onClick={() => navigate('/games')} className="mt-4 rounded-xl">Back</Button></div>;

  if (finished) return <GameResults score={score} total={items.length} correct={correct} onFinish={handleFinish} />;

  const current = items[round];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => navigate('/games')}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-2xl font-display font-bold text-foreground">Grammar Dictation 🎧</h1>
        <span className="ml-auto text-sm font-bold text-primary">{score} pts</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Round {round + 1} / {items.length}</p>

      <motion.div key={round} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-8 game-card-shadow text-center space-y-6">
        <Button variant="outline" size="lg" className="rounded-xl gap-2 mx-auto" onClick={() => speak(current.text, current.gender)}>
          <Volume2 className="w-5 h-5" /> Listen Again
        </Button>

        <div className="max-w-md mx-auto space-y-4">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type what you hear..."
            className="rounded-xl text-center text-lg"
            onKeyDown={e => e.key === 'Enter' && (!showAnswer ? submit() : next())}
            disabled={showAnswer}
            autoFocus
          />
          {!showAnswer ? (
            <Button onClick={submit} className="w-full rounded-xl font-bold" disabled={!input.trim()}>Check</Button>
          ) : (
            <div className="space-y-3">
              <p className={`text-lg font-bold ${lastCorrect ? 'text-primary' : 'text-destructive'}`}>
                {lastCorrect ? '✅ Correct!' : '❌ Wrong!'}
              </p>
              {!lastCorrect && (
                <p className="text-sm text-muted-foreground">Correct answer: <span className="font-bold text-foreground">{current.text}</span></p>
              )}
              <Button onClick={next} className="w-full rounded-xl font-bold">
                {round + 1 >= items.length ? 'See Results' : 'Next'}
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default GrammarDictationGame;
