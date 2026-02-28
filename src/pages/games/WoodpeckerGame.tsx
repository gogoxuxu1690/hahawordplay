import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';

interface Caterpillar {
  id: string;
  word: string;
  holeIndex: number;
  visible: boolean;
}

const HOLES = [
  { x: 20, y: 15 }, { x: 65, y: 10 },
  { x: 10, y: 45 }, { x: 55, y: 40 },
  { x: 35, y: 70 }, { x: 70, y: 65 },
];

const WoodpeckerGame = () => {
  const { words, loading } = useGameWords();
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [caterpillars, setCaterpillars] = useState<Caterpillar[]>([]);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [pecked, setPecked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const current = words[currentIndex];

  const spawnCaterpillars = useCallback(() => {
    if (!current || words.length < 2) return;
    const others = words.filter(w => w.id !== current.id);
    const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [current, ...distractors].sort(() => Math.random() - 0.5);
    setCaterpillars(all.map((w, i) => ({
      id: w.id,
      word: w.word,
      holeIndex: i % HOLES.length,
      visible: true,
    })));
  }, [current, words]);

  useEffect(() => {
    if (!current || finished) return;
    spawnCaterpillars();
    setPecked(null);
    setFeedback(null);
  }, [currentIndex, current, finished]);

  const handlePeck = async (cat: Caterpillar) => {
    if (pecked || !current) return;
    setPecked(cat.id);
    const correct = cat.id === current.id;
    if (correct) playCorrect(); else playWrong();
    setFeedback(correct ? 'correct' : 'wrong');
    await recordResult(current.id, correct);
    const newResults = [...results, correct];
    setResults(newResults);

    setTimeout(() => {
      if (currentIndex + 1 >= words.length) {
        const correctCount = newResults.filter(Boolean).length;
        saveSession('woodpecker', correctCount * 10, words.length, correctCount);
        playFinish();
        setFinished(true);
      } else {
        setCurrentIndex(i => i + 1);
      }
    }, 1000);
  };

  const reset = () => {
    setCurrentIndex(0);
    setResults([]);
    setFinished(false);
    setPecked(null);
    setFeedback(null);
    setCaterpillars([]);
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  if (words.length < 2) return <div className="text-center py-20 text-muted-foreground">Need at least 2 words!</div>;
  if (finished) {
    const c = results.filter(Boolean).length;
    return <GameResults score={c * 10} total={words.length} correct={c} gameType="woodpecker" onPlayAgain={reset} />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display font-bold text-foreground">Woodpecker 🐦</h1>
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
        className="bg-card rounded-2xl game-card-shadow p-4 text-center mb-4"
      >
        {current.image_url ? (
          <img src={current.image_url} alt="target" className="w-20 h-20 object-cover rounded-xl mx-auto mb-2" />
        ) : (
          <p className="text-muted-foreground mb-2">{current.description || 'Find the word!'}</p>
        )}
        <p className="text-sm font-semibold text-muted-foreground">Peck the correct caterpillar! 🐛</p>
      </motion.div>

      {/* Tree with holes */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-emerald-800/20 to-amber-900/30 border border-border" style={{ height: 340 }}>
        {/* Tree trunk visual */}
        <div className="absolute inset-x-1/3 inset-y-0 rounded-t-3xl" style={{ background: 'linear-gradient(to bottom, hsl(30 60% 30% / 0.2), hsl(30 60% 20% / 0.3))' }} />

        {/* Caterpillars in holes */}
        <AnimatePresence>
          {caterpillars.map((cat) => {
            const hole = HOLES[cat.holeIndex];
            const isPecked = cat.id === pecked;
            const isCorrect = cat.id === current.id;
            return (
              <motion.button
                key={cat.id}
                initial={{ x: -40, opacity: 0 }}
                animate={{
                  x: [0, 8, 0, -8, 0],
                  opacity: 1,
                  scale: isPecked ? (isCorrect ? 1.2 : 0.8) : 1,
                }}
                transition={{
                  x: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                  opacity: { duration: 0.3 },
                }}
                exit={{ y: 20, opacity: 0 }}
                onClick={() => handlePeck(cat)}
                disabled={!!pecked}
                className={`absolute flex items-center gap-1 px-3 py-2 rounded-full font-bold text-sm cursor-pointer transition-all
                  ${isPecked && isCorrect ? 'bg-secondary text-secondary-foreground ring-2 ring-secondary' : ''}
                  ${isPecked && !isCorrect ? 'bg-destructive/20 text-destructive ring-2 ring-destructive' : ''}
                  ${!isPecked ? 'bg-card text-foreground game-card-shadow hover:scale-110' : ''}
                `}
                style={{ left: `${hole.x}%`, top: `${hole.y}%` }}
              >
                <span className="text-base">🐛</span>
                {cat.word}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Peck effect */}
        <AnimatePresence>
          {pecked && (
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center text-6xl pointer-events-none"
            >
              {feedback === 'correct' ? '🎯' : '💥'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WoodpeckerGame;
