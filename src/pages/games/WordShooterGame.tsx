import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';

const BUBBLE_TRAVEL_TIME = 8; // seconds
const BUBBLE_COUNT = 4;

interface FloatingBubble {
  id: string;
  word: string;
  x: number; // percent 0-100
  startedAt: number;
}

const WordShooterGame = () => {
  const { words, loading } = useGameWords();
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bubbles, setBubbles] = useState<FloatingBubble[]>([]);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [arrowTarget, setArrowTarget] = useState<{ x: number; y: number } | null>(null);
  const [hitBubbleId, setHitBubbleId] = useState<string | null>(null);
  const [hitCorrect, setHitCorrect] = useState<boolean | null>(null);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = words[currentIndex];

  // TTS speak
  const speak = useCallback(() => {
    if (!current) return;
    const u = new SpeechSynthesisUtterance(current.word);
    u.lang = 'en-US';
    const voices = speechSynthesis.getVoices();
    const gender = current.voice_gender || 'female';
    const preferred = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes(gender));
    if (preferred) u.voice = preferred;
    speechSynthesis.speak(u);
  }, [current]);

  // Spawn bubbles for current word
  const spawnBubbles = useCallback(() => {
    if (!current || words.length < 2) return;
    const others = words.filter(w => w.id !== current.id);
    const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, BUBBLE_COUNT - 1);
    const all = [...distractors.map(w => w.word), current.word].sort(() => Math.random() - 0.5);
    const spacing = 80 / (all.length + 1);
    const now = Date.now();
    setBubbles(all.map((word, i) => ({
      id: `${now}-${i}`,
      word,
      x: 10 + spacing * (i + 1) - spacing / 2 + (Math.random() * 6 - 3),
      startedAt: now,
    })));
  }, [current, words]);

  // Auto-speak + spawn on new round
  useEffect(() => {
    if (!current || finished) return;
    setLocked(false);
    setHitBubbleId(null);
    setHitCorrect(null);
    setArrowTarget(null);
    setParticles([]);
    spawnBubbles();
    const t = setTimeout(speak, 400);
    return () => clearTimeout(t);
  }, [currentIndex, current, finished]);

  // Handle timeout — if bubbles reach top without selection
  useEffect(() => {
    if (locked || finished || !current) return;
    const timer = setTimeout(() => {
      // auto-miss
      handleSelect(null);
    }, (BUBBLE_TRAVEL_TIME + 0.5) * 1000);
    return () => clearTimeout(timer);
  }, [currentIndex, locked, finished, current]);

  const handleSelect = async (word: string | null) => {
    if (locked || !current || finished) return;
    setLocked(true);
    const correct = word === current.word;

    // Find the bubble element position for arrow
    if (word) {
      const bubble = bubbles.find(b => b.word === word);
      if (bubble && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const bx = (bubble.x / 100) * rect.width;
        // Estimate current Y based on elapsed time
        const elapsed = (Date.now() - bubble.startedAt) / 1000;
        const progress = Math.min(elapsed / BUBBLE_TRAVEL_TIME, 1);
        const by = rect.height * (1 - progress);
        setArrowTarget({ x: bx, y: by });

        // Set hit state after arrow "flies"
        setTimeout(() => {
          setHitBubbleId(bubble.id);
          setHitCorrect(correct);
          if (correct) {
            playCorrect();
            // Spawn particles at bubble position
            setParticles(Array.from({ length: 8 }, (_, i) => ({ id: i, x: bx, y: by })));
          } else {
            playWrong();
          }
        }, 300);
      }
    } else {
      // Timeout miss
      playWrong();
    }

    await recordResult(current.id, correct);
    const newResults = [...results, correct];
    setResults(newResults);

    setTimeout(() => {
      setArrowTarget(null);
      setParticles([]);
      setBubbles([]);
      if (currentIndex + 1 >= words.length) {
        const correctCount = newResults.filter(Boolean).length;
        const mastery = Math.round((correctCount / words.length) * 100);
        saveSession('word-shooter', correctCount * 10, words.length, correctCount);
        playFinish(mastery);
        setFinished(true);
      } else {
        setCurrentIndex(i => i + 1);
      }
    }, 1200);
  };

  const reset = () => {
    setCurrentIndex(0);
    setResults([]);
    setFinished(false);
    setLocked(false);
    setBubbles([]);
    setHitBubbleId(null);
    setHitCorrect(null);
    setArrowTarget(null);
    setParticles([]);
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  if (words.length < 2) return <div className="text-center py-20 text-muted-foreground">Need at least 2 words!</div>;
  if (finished) {
    const c = results.filter(Boolean).length;
    return <GameResults score={c * 10} total={words.length} correct={c} gameType="word-shooter" onPlayAgain={reset} />;
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Word Shooter 🎯</h1>
        <span className="text-sm text-muted-foreground font-semibold">{currentIndex + 1} / {words.length}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted mb-4">
        <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${(currentIndex / words.length) * 100}%` }} />
      </div>

      {/* Listen prompt */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl game-card-shadow p-5 text-center mb-4 relative z-10"
      >
        <p className="text-base font-display font-bold text-foreground mb-3">🎧 Listen & Shoot the word!</p>
        <Button onClick={speak} variant="outline" className="rounded-xl gap-2" size="sm">
          <Volume2 className="w-4 h-4" /> Listen Again
        </Button>
      </motion.div>

      {/* Game arena */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-muted/30 border border-border"
        style={{ height: 360 }}
      >
        {/* Floating bubbles */}
        <AnimatePresence>
          {bubbles.map((bubble) => {
            const isHit = hitBubbleId === bubble.id;
            const exploded = isHit && hitCorrect === true;
            const shaking = isHit && hitCorrect === false;

            if (exploded) return null; // removed on correct

            return (
              <motion.button
                key={bubble.id}
                initial={{ y: '100%', opacity: 0 }}
                animate={shaking ? {
                  y: '-100%',
                  opacity: 1,
                  x: [0, -8, 8, -8, 8, 0],
                  transition: {
                    y: { duration: BUBBLE_TRAVEL_TIME, ease: 'linear' },
                    x: { duration: 0.4, ease: 'easeInOut' },
                  }
                } : {
                  y: '-100%',
                  opacity: 1,
                  transition: { duration: BUBBLE_TRAVEL_TIME, ease: 'linear' }
                }}
                exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.2 } }}
                onClick={() => !locked && handleSelect(bubble.word)}
                disabled={locked}
                className="absolute bottom-0 px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-base cursor-pointer hover:brightness-110 active:scale-95 transition-all whitespace-nowrap shadow-lg"
                style={{
                  left: `${bubble.x}%`,
                  transform: 'translateX(-50%)',
                  minWidth: 120,
                  textAlign: 'center',
                }}
              >
                {bubble.word}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Arrow animation */}
        <AnimatePresence>
          {arrowTarget && (
            <motion.div
              initial={{ bottom: 0, left: '50%', opacity: 1 }}
              animate={{ bottom: `calc(100% - ${arrowTarget.y}px)`, left: arrowTarget.x, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="absolute text-2xl pointer-events-none z-20"
              style={{ transform: 'translate(-50%, 50%)' }}
            >
              🏹
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explosion particles */}
        <AnimatePresence>
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ x: p.x, y: p.y, opacity: 1, scale: 1 }}
              animate={{
                x: p.x + (Math.random() - 0.5) * 120,
                y: p.y + (Math.random() - 0.5) * 120,
                opacity: 0,
                scale: 0.3,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute w-3 h-3 rounded-full bg-primary pointer-events-none z-10"
            />
          ))}
        </AnimatePresence>

        {/* Feedback overlay */}
        <AnimatePresence>
          {hitBubbleId && hitCorrect !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 flex items-center justify-center z-30 pointer-events-none`}
            >
              <span className={`text-5xl font-display font-bold ${hitCorrect ? 'text-secondary' : 'text-destructive'}`}>
                {hitCorrect ? '💥 Hit!' : '✗ Miss!'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WordShooterGame;
