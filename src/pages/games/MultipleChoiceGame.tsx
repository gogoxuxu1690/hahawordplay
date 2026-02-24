import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { GameResults } from '@/components/GameResults';

const MultipleChoiceGame = () => {
  const { words, loading } = useGameWords();
  const { recordResult, saveSession } = useRecordResult();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  const current = words[currentIndex];

  const options = useMemo(() => {
    if (!current || words.length < 2) return [];
    const others = words.filter(w => w.id !== current.id);
    const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [...shuffled.map(w => w.word), current.word];
    return all.sort(() => Math.random() - 0.5);
  }, [current, words]);

  const handleSelect = async (option: string) => {
    if (selected) return;
    setSelected(option);
    const correct = option === current.word;
    await recordResult(current.id, correct);
    const newResults = [...results, correct];
    setResults(newResults);

    setTimeout(async () => {
      if (currentIndex + 1 >= words.length) {
        const correctCount = newResults.filter(Boolean).length;
        await saveSession('multiple-choice', correctCount * 10, words.length, correctCount);
        setFinished(true);
      } else {
        setCurrentIndex(i => i + 1);
        setSelected(null);
      }
    }, 1200);
  };

  const reset = () => {
    setCurrentIndex(0);
    setSelected(null);
    setResults([]);
    setFinished(false);
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  if (words.length < 2) return <div className="text-center py-20 text-muted-foreground">Need at least 2 words!</div>;

  if (finished) {
    const correct = results.filter(Boolean).length;
    return <GameResults score={correct * 10} total={words.length} correct={correct} gameType="multiple-choice" onPlayAgain={reset} />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Multiple Choice ❓</h1>
        <span className="text-sm text-muted-foreground font-semibold">{currentIndex + 1} / {words.length}</span>
      </div>

      <div className="w-full h-2 rounded-full bg-muted mb-8">
        <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${((currentIndex) / words.length) * 100}%` }} />
      </div>

      <motion.div key={currentIndex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Question */}
        <div className="bg-card rounded-2xl game-card-shadow p-8 text-center mb-6">
          {current.image_url && (
            <img src={current.image_url} alt="?" className="w-36 h-36 object-cover rounded-2xl mx-auto mb-4" />
          )}
          <p className="text-lg font-display font-bold text-foreground">What word matches this?</p>
          {current.description && <p className="text-sm text-muted-foreground mt-2">{current.description}</p>}
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3">
          {options.map((option, i) => {
            const isCorrect = option === current.word;
            const isSelected = option === selected;
            let bg = 'bg-card hover:bg-muted/50';
            if (selected) {
              if (isCorrect) bg = 'bg-secondary/30 ring-2 ring-secondary';
              else if (isSelected) bg = 'bg-destructive/20 ring-2 ring-destructive';
            }

            return (
              <motion.button
                key={option}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelect(option)}
                className={`p-4 rounded-xl font-bold text-foreground game-card-shadow transition-all ${bg}`}
              >
                {option}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default MultipleChoiceGame;
