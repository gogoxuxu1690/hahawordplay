import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';

const PictureDictationGame = () => {
  const { words, loading } = useGameWords();
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [spoken, setSpoken] = useState(false);

  const current = words[currentIndex];

  // Only use words that have images
  const wordsWithImages = useMemo(() => words.filter(w => w.image_url), [words]);

  const options = useMemo(() => {
    if (!current || wordsWithImages.length < 2) return [];
    const others = wordsWithImages.filter(w => w.id !== current.id);
    const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 5);
    // Ensure current is included
    const all = [current, ...shuffled].slice(0, 6).sort(() => Math.random() - 0.5);
    return all;
  }, [current, wordsWithImages]);

  const speak = () => {
    if (!current) return;
    const u = new SpeechSynthesisUtterance(current.word);
    u.lang = 'en-US';
    speechSynthesis.speak(u);
    setSpoken(true);
  };

  // Auto-speak on new word
  useEffect(() => {
    if (current && !finished) {
      setSpoken(false);
      const t = setTimeout(speak, 500);
      return () => clearTimeout(t);
    }
  }, [currentIndex, current, finished]);

  const handleSelect = async (wordId: string) => {
    if (selected || !current) return;
    setSelected(wordId);
    const correct = wordId === current.id;
    if (correct) playCorrect(); else playWrong();
    await recordResult(current.id, correct);
    const newResults = [...results, correct];
    setResults(newResults);

    setTimeout(async () => {
      if (currentIndex + 1 >= wordsWithImages.length || currentIndex + 1 >= words.length) {
        const correctCount = newResults.filter(Boolean).length;
        const mastery = Math.round((correctCount / newResults.length) * 100);
        await saveSession('picture-dictation', correctCount * 10, newResults.length, correctCount);
        playFinish(mastery);
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
    setSpoken(false);
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  if (wordsWithImages.length < 2) return <div className="text-center py-20 text-muted-foreground">Need at least 2 words with images!</div>;

  if (finished) {
    const c = results.filter(Boolean).length;
    return <GameResults score={c * 10} total={results.length} correct={c} gameType="picture-dictation" onPlayAgain={reset} />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display font-bold text-foreground">Picture Dictation 🎧</h1>
        <span className="text-sm text-muted-foreground font-semibold">{currentIndex + 1} / {Math.min(wordsWithImages.length, words.length)}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted mb-6">
        <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${(currentIndex / Math.min(wordsWithImages.length, words.length)) * 100}%` }} />
      </div>

      {/* Listen prompt */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl game-card-shadow p-8 text-center mb-6"
      >
        <p className="text-lg font-display font-bold text-foreground mb-4">Listen and pick the right image!</p>
        <Button onClick={speak} className="rounded-xl gap-2" size="lg">
          <Volume2 className="w-5 h-5" /> {spoken ? 'Listen Again' : 'Listen'}
        </Button>
      </motion.div>

      {/* Image grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {options.map((opt, i) => {
          const isCorrect = opt.id === current.id;
          const isSelected = opt.id === selected;
          let ring = 'ring-transparent';
          if (selected) {
            if (isCorrect) ring = 'ring-2 ring-secondary';
            else if (isSelected) ring = 'ring-2 ring-destructive';
          }
          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleSelect(opt.id)}
              className={`rounded-2xl overflow-hidden game-card-shadow aspect-square ${ring} transition-all`}
            >
              <img src={opt.image_url!} alt="option" className="w-full h-full object-cover" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default PictureDictationGame;
