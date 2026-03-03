import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';

const BUBBLE_TRAVEL_TIME = 8; // seconds visible
const SPEED_MULTIPLIER = 1.3; // 1.3x faster
const ANIMATION_DURATION = BUBBLE_TRAVEL_TIME / SPEED_MULTIPLIER; // ~6.15s animation for 8s visibility window
const BUBBLE_COUNT = 4;
const STAGGER_DELAY = 0.5; // seconds between each bubble entry
const ARENA_HEIGHT = 420;

interface FloatingBubble {
  id: string;
  word: string;
  x: number; // percent 5-95
  delay: number; // stagger delay in seconds
  startedAt: number;
}

// Generate well-spaced random X positions with collision avoidance
const generateSpacedPositions = (count: number): number[] => {
  const minGap = 22; // minimum % gap between bubbles
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let pos: number;
    do {
      pos = 8 + Math.random() * 64; // keep within 8%-72% so bubble + width stays in view
      attempts++;
    } while (
      attempts < 50 &&
      positions.some(p => Math.abs(p - pos) < minGap)
    );
    positions.push(pos);
  }
  return positions;
};

const WordShooterGame = () => {
  const { words, loading } = useGameWords();
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bubbles, setBubbles] = useState<FloatingBubble[]>([]);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [arrowAnim, setArrowAnim] = useState<{ fromX: number; fromY: number; toX: number; toY: number } | null>(null);
  const [hitBubbleId, setHitBubbleId] = useState<string | null>(null);
  const [hitCorrect, setHitCorrect] = useState<boolean | null>(null);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

  // Spawn bubbles with collision avoidance and staggered entry
  const spawnBubbles = useCallback(() => {
    if (!current || words.length < 2) return;
    const others = words.filter(w => w.id !== current.id);
    const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, BUBBLE_COUNT - 1);
    const all = [...distractors.map(w => w.word), current.word].sort(() => Math.random() - 0.5);
    const positions = generateSpacedPositions(all.length);
    const now = Date.now();
    setBubbles(all.map((word, i) => ({
      id: `${now}-${i}`,
      word,
      x: positions[i],
      delay: i * STAGGER_DELAY,
      startedAt: now + i * STAGGER_DELAY * 1000,
    })));
  }, [current, words]);

  // Auto-speak + spawn on new round
  useEffect(() => {
    if (!current || finished) return;
    setLocked(false);
    setHitBubbleId(null);
    setHitCorrect(null);
    setArrowAnim(null);
    setParticles([]);
    bubbleRefs.current.clear();
    spawnBubbles();
    const t = setTimeout(speak, 400);
    return () => clearTimeout(t);
  }, [currentIndex, current, finished]);

  // Handle timeout
  useEffect(() => {
    if (locked || finished || !current) return;
    const maxDelay = (BUBBLE_COUNT - 1) * STAGGER_DELAY;
    const timer = setTimeout(() => {
      handleSelect(null);
    }, (ANIMATION_DURATION + maxDelay + 0.5) * 1000);
    return () => clearTimeout(timer);
  }, [currentIndex, locked, finished, current]);

  const handleSelect = async (word: string | null) => {
    if (locked || !current || finished) return;
    setLocked(true);
    const correct = word === current.word;

    if (word) {
      const bubble = bubbles.find(b => b.word === word);
      const bubbleEl = bubble ? bubbleRefs.current.get(bubble.id) : null;
      const container = containerRef.current;

      if (bubble && bubbleEl && container) {
        const containerRect = container.getBoundingClientRect();
        const bubbleRect = bubbleEl.getBoundingClientRect();

        // Calculate bubble center relative to container
        const bx = bubbleRect.left - containerRect.left + bubbleRect.width / 2;
        const by = bubbleRect.top - containerRect.top + bubbleRect.height / 2;

        // Arrow from bottom center to bubble
        const fromX = containerRect.width / 2;
        const fromY = containerRect.height;
        setArrowAnim({ fromX, fromY, toX: bx, toY: by });

        setTimeout(() => {
          setHitBubbleId(bubble.id);
          setHitCorrect(correct);
          if (correct) {
            playCorrect();
            setParticles(Array.from({ length: 10 }, (_, i) => ({ id: i, x: bx, y: by })));
          } else {
            playWrong();
          }
        }, 280);
      }
    } else {
      playWrong();
    }

    await recordResult(current.id, correct);
    const newResults = [...results, correct];
    setResults(newResults);

    setTimeout(() => {
      setArrowAnim(null);
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
    setArrowAnim(null);
    setParticles([]);
    bubbleRefs.current.clear();
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
        style={{ height: ARENA_HEIGHT }}
      >
        {/* Floating bubbles */}
        <AnimatePresence>
          {bubbles.map((bubble) => {
            const isHit = hitBubbleId === bubble.id;
            const exploded = isHit && hitCorrect === true;
            const shaking = isHit && hitCorrect === false;

            if (exploded) return null;

            return (
              <motion.button
                key={bubble.id}
                ref={(el) => {
                  if (el) bubbleRefs.current.set(bubble.id, el);
                }}
                initial={{ bottom: -60, opacity: 0 }}
                animate={shaking ? {
                  bottom: ARENA_HEIGHT + 60,
                  opacity: 1,
                  x: [0, -10, 10, -10, 10, 0],
                  transition: {
                    bottom: { duration: ANIMATION_DURATION, ease: 'linear', delay: bubble.delay },
                    opacity: { duration: 0.3, delay: bubble.delay },
                    x: { duration: 0.4, ease: 'easeInOut' },
                  }
                } : {
                  bottom: ARENA_HEIGHT + 60,
                  opacity: 1,
                  transition: {
                    bottom: { duration: ANIMATION_DURATION, ease: 'linear', delay: bubble.delay },
                    opacity: { duration: 0.3, delay: bubble.delay },
                  }
                }}
                exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.2 } }}
                onClick={() => !locked && handleSelect(bubble.word)}
                disabled={locked}
                className="absolute px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg cursor-pointer hover:brightness-110 active:scale-95 transition-colors whitespace-nowrap border-2 border-primary-foreground/20"
                style={{
                  left: `${bubble.x}%`,
                  minWidth: 150,
                  textAlign: 'center',
                  boxShadow: '0 4px 16px hsl(var(--primary) / 0.4)',
                }}
              >
                {bubble.word}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Arrow animation — pixel-precise from bottom-center to target */}
        <AnimatePresence>
          {arrowAnim && (
            <motion.div
              initial={{ left: arrowAnim.fromX, top: arrowAnim.fromY, opacity: 1 }}
              animate={{ left: arrowAnim.toX, top: arrowAnim.toY, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute text-2xl pointer-events-none z-20"
              style={{
                transform: 'translate(-50%, -50%)',
                // Rotate arrow toward target
                rotate: `${Math.atan2(arrowAnim.toY - arrowAnim.fromY, arrowAnim.toX - arrowAnim.fromX) * (180 / Math.PI) + 90}deg`,
              }}
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
              initial={{ left: p.x, top: p.y, opacity: 1, scale: 1 }}
              animate={{
                left: p.x + (Math.random() - 0.5) * 140,
                top: p.y + (Math.random() - 0.5) * 140,
                opacity: 0,
                scale: 0.2,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute w-3 h-3 rounded-full bg-primary pointer-events-none z-10"
              style={{ transform: 'translate(-50%, -50%)' }}
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
              className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
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
