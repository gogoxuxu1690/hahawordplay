import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';

interface Bubble {
  id: string;
  word: string;
  x: number;
  startTime: number;
}

const WordShooterGame = () => {
  const { words, loading } = useGameWords();
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  

  const current = words[currentIndex];

  const spawnBubbles = useCallback(() => {
    if (!current || words.length < 2) return;
    const others = words.filter(w => w.id !== current.id);
    const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [...distractors.map(w => w.word), current.word].sort(() => Math.random() - 0.5);
    const now = Date.now();
    setBubbles(all.map((word, i) => ({
      id: `${now}-${i}`,
      word,
      x: 10 + (i * 20) + Math.random() * 10,
      startTime: now + i * 400,
    })));
  }, [current, words]);

  useEffect(() => {
    if (!current || finished) return;
    spawnBubbles();
  }, [currentIndex, current, finished]);

  const handleSelect = async (word: string) => {
    if (!current || finished) return;
    clearTimeout(timerRef.current);
    const correct = word === current.word;
    if (correct) playCorrect(); else playWrong();
    setFeedback(correct ? 'correct' : 'wrong');
    await recordResult(current.id, correct);
    const newResults = [...results, correct];
    setResults(newResults);

    setTimeout(() => {
      setFeedback(null);
      setBubbles([]);
      if (currentIndex + 1 >= words.length) {
        const correctCount = newResults.filter(Boolean).length;
        const mastery = Math.round((correctCount / words.length) * 100);
        saveSession('word-shooter', correctCount * 10, words.length, correctCount);
        playFinish(mastery);
      } else {
        setCurrentIndex(i => i + 1);
      }
    }, 800);
  };

  const reset = () => {
    setCurrentIndex(0);
    setResults([]);
    setFinished(false);
    setFeedback(null);
    setBubbles([]);
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  if (words.length < 2) return <div className="text-center py-20 text-muted-foreground">Need at least 2 words!</div>;
  if (finished) {
    const c = results.filter(Boolean).length;
    return <GameResults score={c * 10} total={words.length} correct={c} gameType="word-shooter" onPlayAgain={reset} />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display font-bold text-foreground">Word Shooter 🎯</h1>
        <span className="text-sm text-muted-foreground font-semibold">{currentIndex + 1} / {words.length}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted mb-6">
        <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${(currentIndex / words.length) * 100}%` }} />
      </div>

      {/* Target */}
      <motion.div
        key={currentIndex}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-2xl game-card-shadow p-6 text-center mb-6"
      >
        {current.image_url ? (
          <img src={current.image_url} alt="target" className="w-28 h-28 object-cover rounded-2xl mx-auto mb-3" />
        ) : (
          <p className="text-lg text-muted-foreground mb-2">{current.description || 'Which word?'}</p>
        )}
        <p className="text-sm font-semibold text-muted-foreground">Shoot the correct word! 🎯</p>
      </motion.div>

      {/* Feedback flash */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`text-center text-4xl font-display font-bold mb-4 ${feedback === 'correct' ? 'text-secondary' : 'text-destructive'}`}
          >
            {feedback === 'correct' ? '✓ Hit!' : '✗ Miss!'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Word options grid */}
      <div className="grid grid-cols-2 gap-3 px-2">
        {!feedback && bubbles.map((bubble) => (
          <motion.button
            key={bubble.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            onClick={() => handleSelect(bubble.word)}
            className="px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base game-card-shadow cursor-pointer hover:scale-105 active:scale-95 transition-transform text-center"
          >
            {bubble.word}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default WordShooterGame;
