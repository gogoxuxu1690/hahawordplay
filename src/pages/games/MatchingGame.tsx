import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';

function speakWord(word: string, gender: string) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.pitch = gender === 'male' ? 0.9 : 1.2;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

const CARD_SIZE = 'h-24 w-full';

const MatchingGame = () => {
  const { words, loading } = useGameWords(6);
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong } = useGameSounds();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<{ word?: string; image?: string } | null>(null);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [finished, setFinished] = useState(false);

  const shuffledWords = useMemo(() => [...words].sort(() => Math.random() - 0.5), [words]);
  const shuffledImages = useMemo(() => [...words].sort(() => Math.random() - 0.5), [words]);

  const tryMatch = async (wordId: string | null, imageId: string | null) => {
    const w = wordId || selectedWord;
    const img = imageId || selectedImage;
    if (!w || !img) return;

    setAttempts(a => a + 1);
    if (w === img) {
      playCorrect();
      setMatched(prev => new Set([...prev, w]));
      setScore(s => s + 10);
      await recordResult(w, true);
      setSelectedWord(null);
      setSelectedImage(null);

      if (matched.size + 1 >= words.length) {
        const correctCount = matched.size + 1;
        await saveSession('matching', (matched.size + 1) * 10, words.length, correctCount);
        setFinished(true);
      }
    } else {
      playWrong();
      setWrong({ word: w, image: img });
      await recordResult(w, false);
      setTimeout(() => {
        setWrong(null);
        setSelectedWord(null);
        setSelectedImage(null);
      }, 800);
    }
  };

  const selectWord = (id: string) => {
    if (matched.has(id)) return;
    setSelectedWord(id);
    if (selectedImage) tryMatch(id, null);
  };

  const selectImage = (id: string) => {
    if (matched.has(id)) return;
    setSelectedImage(id);
    if (selectedWord) tryMatch(null, id);
  };

  const handleSpeak = useCallback((e: React.MouseEvent, word: typeof words[0]) => {
    e.stopPropagation();
    speakWord(word.word, word.voice_gender);
  }, []);

  const reset = () => {
    setSelectedWord(null);
    setSelectedImage(null);
    setMatched(new Set());
    setWrong(null);
    setScore(0);
    setAttempts(0);
    setFinished(false);
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  if (words.length < 2) return <div className="text-center py-20 text-muted-foreground">Need at least 2 words with images!</div>;

  if (finished) {
    return <GameResults score={score} total={words.length} correct={matched.size} gameType="matching" onPlayAgain={reset} />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Matching 🧩</h1>
        <span className="text-sm text-muted-foreground font-semibold">Score: {score}</span>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-3">
          <p className="text-sm font-bold text-muted-foreground mb-2">Words</p>
          {shuffledWords.map(word => {
            const isMatched = matched.has(word.id);
            const isSelected = selectedWord === word.id;
            const isWrong = wrong?.word === word.id;
            return (
              <motion.button
                key={word.id}
                layout
                whileTap={{ scale: 0.95 }}
                onClick={() => !isMatched && selectWord(word.id)}
                className={`${CARD_SIZE} flex items-center justify-center gap-2 rounded-xl font-bold transition-all ${
                  isMatched ? 'bg-secondary/30 text-secondary-foreground opacity-50' :
                  isWrong ? 'bg-destructive/20 ring-2 ring-destructive' :
                  isSelected ? 'bg-primary text-primary-foreground game-card-shadow' :
                  'bg-card text-foreground game-card-shadow hover:game-card-shadow-hover'
                }`}
              >
                <span className="truncate">{word.word}</span>
                {!isMatched && (
                  <button
                    onClick={(e) => handleSpeak(e, word)}
                    className="flex-shrink-0 p-1.5 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-bold text-muted-foreground mb-2">Images</p>
          {shuffledImages.map(word => {
            const isMatched = matched.has(word.id);
            const isSelected = selectedImage === word.id;
            const isWrong = wrong?.image === word.id;
            return (
              <motion.button
                key={word.id}
                layout
                whileTap={{ scale: 0.95 }}
                onClick={() => !isMatched && selectImage(word.id)}
                className={`${CARD_SIZE} flex items-center justify-center rounded-xl transition-all ${
                  isMatched ? 'bg-secondary/30 opacity-50' :
                  isWrong ? 'bg-destructive/20 ring-2 ring-destructive' :
                  isSelected ? 'ring-2 ring-primary game-card-shadow' :
                  'bg-card game-card-shadow hover:game-card-shadow-hover'
                }`}
              >
                {word.image_url ? (
                  <img src={word.image_url} alt="?" className="w-16 h-16 object-cover rounded-lg" />
                ) : (
                  <span className="text-2xl">{word.description?.slice(0, 20) || '?'}</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MatchingGame;
