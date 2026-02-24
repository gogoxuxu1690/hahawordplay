import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { GameResults } from '@/components/GameResults';

const FlashcardsGame = () => {
  const { words, loading } = useGameWords();
  const { recordResult, saveSession } = useRecordResult();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  const current = words[currentIndex];

  const speak = (text: string, gender: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    speechSynthesis.speak(u);
  };

  const markAndNext = async (correct: boolean) => {
    if (!current) return;
    await recordResult(current.id, correct);
    const newResults = [...results, correct];
    setResults(newResults);
    setFlipped(false);

    if (currentIndex + 1 >= words.length) {
      const correctCount = newResults.filter(Boolean).length;
      await saveSession('flashcards', correctCount * 10, words.length, correctCount);
      setFinished(true);
    } else {
      setTimeout(() => setCurrentIndex(i => i + 1), 200);
    }
  };

  const reset = () => {
    setCurrentIndex(0);
    setFlipped(false);
    setResults([]);
    setFinished(false);
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  if (words.length === 0) return <div className="text-center py-20 text-muted-foreground">No words found. Add some first!</div>;

  if (finished) {
    const correct = results.filter(Boolean).length;
    return <GameResults score={correct * 10} total={words.length} correct={correct} gameType="flashcards" onPlayAgain={reset} />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Flashcards 🃏</h1>
        <span className="text-sm text-muted-foreground font-semibold">{currentIndex + 1} / {words.length}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-muted mb-8">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${((currentIndex) / words.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        className="cursor-pointer"
        onClick={() => setFlipped(!flipped)}
      >
        <div className="bg-card rounded-2xl game-card-shadow p-8 min-h-[320px] flex flex-col items-center justify-center text-center relative">
          <AnimatePresence mode="wait">
            {!flipped ? (
              <motion.div key="front" initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} exit={{ rotateY: -90 }} transition={{ duration: 0.3 }}>
                {current.image_url && (
                  <img src={current.image_url} alt={current.word} className="w-40 h-40 object-cover rounded-2xl mb-4 mx-auto" />
                )}
                <h2 className="text-3xl font-display font-bold text-foreground">{current.word}</h2>
                <p className="text-sm text-muted-foreground mt-3">Tap to reveal</p>
              </motion.div>
            ) : (
              <motion.div key="back" initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} exit={{ rotateY: -90 }} transition={{ duration: 0.3 }}>
                <p className="text-lg text-foreground mb-4">{current.description || 'No description'}</p>
                <Button variant="ghost" size="sm" className="rounded-xl gap-2" onClick={e => { e.stopPropagation(); speak(current.word, current.voice_gender); }}>
                  <Volume2 className="w-4 h-4" /> Listen
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {flipped && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 justify-center mt-6">
          <Button variant="outline" className="rounded-xl gap-2 border-destructive text-destructive" onClick={() => markAndNext(false)}>
            Still Learning
          </Button>
          <Button className="rounded-xl gap-2 bg-secondary text-secondary-foreground" onClick={() => markAndNext(true)}>
            Got It! ✓
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default FlashcardsGame;
