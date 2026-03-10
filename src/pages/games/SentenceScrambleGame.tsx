import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGrammarPairs } from '@/hooks/useGrammarPairs';
import { useGameSounds } from '@/hooks/useGameSounds';
import { useRecordResult } from '@/hooks/useGameWords';
import { GameResults } from '@/components/GameResults';

// Split sentence into tokens, keeping punctuation attached to the preceding word
function tokenize(sentence: string): string[] {
  // Match word optionally followed by punctuation
  const matches = sentence.match(/\S+/g) || [];
  // Merge standalone punctuation with previous token
  const result: string[] = [];
  for (const token of matches) {
    if (/^[.,!?;:]+$/.test(token) && result.length > 0) {
      result[result.length - 1] += token;
    } else {
      result.push(token);
    }
  }
  return result;
}

const SentenceScrambleGame = () => {
  const navigate = useNavigate();
  const { pairs, loading } = useGrammarPairs(10);
  const { playCorrect, playWrong } = useGameSounds();
  const { saveSession } = useRecordResult();

  const [items, setItems] = useState<{ original: string; tokens: string[] }[]>([]);
  const [round, setRound] = useState(0);
  const [scrambled, setScrambled] = useState<string[]>([]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [result, setResult] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (pairs.length === 0) return;
    const arr = pairs.map(p => {
      const text = Math.random() > 0.5 ? p.question : p.answer;
      return { original: text, tokens: tokenize(text) };
    });
    setItems(arr);
  }, [pairs]);

  useEffect(() => {
    if (items.length > 0 && round < items.length) {
      const shuffled = [...items[round].tokens].sort(() => Math.random() - 0.5);
      // Ensure it's actually scrambled
      if (shuffled.join(' ') === items[round].tokens.join(' ') && shuffled.length > 1) {
        [shuffled[0], shuffled[shuffled.length - 1]] = [shuffled[shuffled.length - 1], shuffled[0]];
      }
      setScrambled(shuffled);
      setPlaced([]);
      setResult(null);
    }
  }, [round, items]);

  const addToken = (token: string, idx: number) => {
    if (result !== null) return;
    setPlaced(prev => [...prev, token]);
    setScrambled(prev => prev.filter((_, i) => i !== idx));
  };

  const removeToken = (idx: number) => {
    if (result !== null) return;
    const token = placed[idx];
    setPlaced(prev => prev.filter((_, i) => i !== idx));
    setScrambled(prev => [...prev, token]);
  };

  const check = useCallback(() => {
    const answer = placed.join(' ');
    const isCorrect = answer === items[round].tokens.join(' ');
    setResult(isCorrect);
    if (isCorrect) {
      playCorrect();
      setScore(s => s + 10);
      setCorrect(c => c + 1);
    } else {
      playWrong();
    }
  }, [placed, items, round, playCorrect, playWrong]);

  const next = () => {
    if (round + 1 >= items.length) {
      setFinished(true);
    } else {
      setRound(r => r + 1);
    }
  };

  const reset = () => {
    if (items.length > 0) {
      const shuffled = [...items[round].tokens].sort(() => Math.random() - 0.5);
      setScrambled(shuffled);
      setPlaced([]);
      setResult(null);
    }
  };

  const handleFinish = useCallback(async () => {
    await saveSession('sentence-scramble', score, items.length, correct);
  }, [saveSession, score, items.length, correct]);

  useEffect(() => { if (finished) handleFinish(); }, [finished, handleFinish]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (items.length < 1) return <div className="text-center py-20"><p className="text-muted-foreground">Need at least 1 pair.</p><Button onClick={() => navigate('/games')} className="mt-4 rounded-xl">Back</Button></div>;

  if (finished) return <GameResults score={score} total={items.length} correct={correct} gameType="sentence-scramble" onPlayAgain={() => window.location.reload()} />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => navigate('/games')}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-2xl font-display font-bold text-foreground">Sentence Scramble 🔀</h1>
        <span className="ml-auto text-sm font-bold text-primary">{score} pts</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Round {round + 1} / {items.length}</p>

      <motion.div key={round} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-6 game-card-shadow space-y-6">
        <p className="text-sm text-muted-foreground text-center">Arrange the words in the correct order:</p>

        {/* Placed words area */}
        <div className="min-h-[60px] p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-wrap gap-2">
          <AnimatePresence>
            {placed.map((token, i) => (
              <motion.button
                key={`placed-${i}-${token}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => removeToken(i)}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-80 transition-opacity"
              >
                {token}
              </motion.button>
            ))}
          </AnimatePresence>
          {placed.length === 0 && <span className="text-muted-foreground text-sm">Tap words below to build the sentence...</span>}
        </div>

        {/* Scrambled words */}
        <div className="flex flex-wrap gap-2 justify-center">
          <AnimatePresence>
            {scrambled.map((token, i) => (
              <motion.button
                key={`scrambled-${i}-${token}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => addToken(token, i)}
                className="px-3 py-2 rounded-lg bg-muted text-foreground font-bold text-sm hover:bg-muted/80 transition-colors"
              >
                {token}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Actions */}
        {result === null ? (
          <div className="flex gap-3 justify-center">
            <Button variant="outline" className="rounded-xl gap-2" onClick={reset}><RotateCcw className="w-4 h-4" /> Reset</Button>
            <Button className="rounded-xl font-bold" onClick={check} disabled={scrambled.length > 0}>Check</Button>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <p className={`text-lg font-bold ${result ? 'text-primary' : 'text-destructive'}`}>
              {result ? '✅ Correct!' : '❌ Wrong!'}
            </p>
            {!result && (
              <p className="text-sm text-muted-foreground">Correct: <span className="font-bold text-foreground">{items[round].original}</span></p>
            )}
            <Button onClick={next} className="rounded-xl font-bold">
              {round + 1 >= items.length ? 'See Results' : 'Next'}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SentenceScrambleGame;
