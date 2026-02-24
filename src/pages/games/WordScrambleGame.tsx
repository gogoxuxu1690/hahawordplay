import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { GameResults } from '@/components/GameResults';

function scramble(word: string): string {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = arr.join('');
  return result === word ? scramble(word) : result;
}

const WordScrambleGame = () => {
  const { words, loading } = useGameWords();
  const { recordResult, saveSession } = useRecordResult();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState<boolean | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  const current = words[currentIndex];
  const scrambled = useMemo(() => current ? scramble(current.word) : '', [current]);

  const checkAnswer = async () => {
    if (!current || showResult !== null) return;
    const correct = answer.toLowerCase().trim() === current.word.toLowerCase().trim();
    setShowResult(correct);
    await recordResult(current.id, correct);
    const newResults = [...results, correct];
    setResults(newResults);

    setTimeout(async () => {
      if (currentIndex + 1 >= words.length) {
        const correctCount = newResults.filter(Boolean).length;
        await saveSession('word-scramble', correctCount * 10, words.length, correctCount);
        setFinished(true);
      } else {
        setCurrentIndex(i => i + 1);
        setAnswer('');
        setShowResult(null);
      }
    }, 1500);
  };

  const reset = () => { setCurrentIndex(0); setAnswer(''); setShowResult(null); setResults([]); setFinished(false); };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  if (words.length === 0) return <div className="text-center py-20 text-muted-foreground">No words found!</div>;
  if (finished) {
    const correct = results.filter(Boolean).length;
    return <GameResults score={correct * 10} total={words.length} correct={correct} gameType="word-scramble" onPlayAgain={reset} />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Word Scramble 🔀</h1>
        <span className="text-sm text-muted-foreground font-semibold">{currentIndex + 1} / {words.length}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted mb-8">
        <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${((currentIndex) / words.length) * 100}%` }} />
      </div>

      <motion.div key={currentIndex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-card rounded-2xl game-card-shadow p-8 text-center mb-6">
          {current.image_url && <img src={current.image_url} alt="?" className="w-32 h-32 object-cover rounded-2xl mx-auto mb-4" />}
          <div className="flex justify-center gap-2 mb-4">
            {scrambled.split('').map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="w-10 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-xl font-display font-bold text-primary"
              >
                {char.toUpperCase()}
              </motion.span>
            ))}
          </div>
          {current.description && <p className="text-sm text-muted-foreground">{current.description}</p>}
        </div>

        <div className="flex gap-3">
          <Input
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && checkAnswer()}
            placeholder="Unscramble the word..."
            className={`rounded-xl text-center text-lg font-bold ${showResult === true ? 'ring-2 ring-secondary' : showResult === false ? 'ring-2 ring-destructive' : ''}`}
          />
          <Button onClick={checkAnswer} className="rounded-xl font-bold" disabled={!answer.trim() || showResult !== null}>
            Check
          </Button>
        </div>
        {showResult === false && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mt-3 text-destructive font-bold">
            The answer was: {current.word}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
};

export default WordScrambleGame;
