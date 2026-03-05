import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameWords, useRecordResult, GameWord } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';
import moleImg from '@/assets/mole.png';

const ROUNDS = 10;
const MOLE_VISIBLE_MS = 4000;
const MOLE_EMERGE_DELAY = 600;

function speakWord(word: string) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const StarBurst = ({ x, y }: { x: number; y: number }) => {
  const stars = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    return { dx: Math.cos(angle) * 60, dy: Math.sin(angle) * 60 };
  });
  return (
    <div className="absolute pointer-events-none" style={{ left: x, top: y, zIndex: 50 }}>
      {stars.map((s, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: s.dx, y: s.dy, opacity: 0, scale: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute text-yellow-400 text-lg"
          style={{ left: -8, top: -8 }}
        >
          ⭐
        </motion.div>
      ))}
    </div>
  );
};

const MoleWhackerGame = () => {
  const navigate = useNavigate();
  const { words, loading } = useGameWords(ROUNDS);
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();

  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'finished'>('playing');
  const [moles, setMoles] = useState<{ word: GameWord; visible: boolean; holeIndex: number }[]>([]);
  const [targetWord, setTargetWord] = useState<GameWord | null>(null);
  const [hitIndex, setHitIndex] = useState<number | null>(null);
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const [starPos, setStarPos] = useState<{ x: number; y: number } | null>(null);
  const [canHit, setCanHit] = useState(true);
  const [hammerActive, setHammerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const gridRef = useRef<HTMLDivElement>(null);

  const setupRound = useCallback((roundIdx: number) => {
    if (roundIdx >= words.length || roundIdx >= ROUNDS) {
      setPhase('finished');
      return;
    }

    const target = words[roundIdx];
    setTargetWord(target);
    setHitIndex(null);
    setWrongIndex(null);
    setStarPos(null);
    setCanHit(true);

    // Pick 3 distractors
    const others = words.filter(w => w.id !== target.id);
    const distractors = shuffle(others).slice(0, 3);
    const options = shuffle([target, ...distractors]);

    // Assign to 4 holes (2x2)
    const holeAssignments = shuffle([0, 1, 2, 3]);
    const newMoles = options.map((w, i) => ({
      word: w,
      visible: false,
      holeIndex: holeAssignments[i],
    }));

    setMoles(newMoles);

    // Speak the word
    setTimeout(() => speakWord(target.word), 300);

    // Emerge moles staggered
    newMoles.forEach((_, i) => {
      setTimeout(() => {
        setMoles(prev => prev.map((m, idx) => idx === i ? { ...m, visible: true } : m));
      }, MOLE_EMERGE_DELAY + i * 200);
    });

    // Auto-retreat after visibility window
    timerRef.current = setTimeout(() => {
      setMoles(prev => prev.map(m => ({ ...m, visible: false })));
      // If player didn't answer, count as wrong
      setTimeout(() => {
        setCanHit(false);
        recordResult(target.id, false);
        setRound(r => r + 1);
      }, 500);
    }, MOLE_VISIBLE_MS + MOLE_EMERGE_DELAY + 800);
  }, [words, recordResult]);

  useEffect(() => {
    if (!loading && words.length > 0 && phase === 'playing') {
      setupRound(round);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [round, loading, words.length, phase]);

  const handleWhack = (moleIdx: number, e: React.MouseEvent) => {
    if (!canHit || !targetWord) return;
    setCanHit(false);
    if (timerRef.current) clearTimeout(timerRef.current);

    setHammerActive(true);
    setTimeout(() => setHammerActive(false), 200);

    const mole = moles[moleIdx];
    const isCorrect = mole.word.id === targetWord.id;

    if (isCorrect) {
      setHitIndex(moleIdx);
      // Star burst at click position relative to grid
      const rect = gridRef.current?.getBoundingClientRect();
      if (rect) {
        setStarPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      playCorrect();
      setScore(s => s + 10);
      setCorrect(c => c + 1);
      recordResult(targetWord.id, true);
    } else {
      setWrongIndex(moleIdx);
      playWrong();
      recordResult(targetWord.id, false);
    }

    // Hide moles and advance
    setTimeout(() => {
      setMoles(prev => prev.map(m => ({ ...m, visible: false })));
      setTimeout(() => setRound(r => r + 1), 400);
    }, 800);
  };

  useEffect(() => {
    if (phase === 'finished' && words.length > 0) {
      saveSession('mole-whacker', score, Math.min(words.length, ROUNDS), correct);
      playFinish(Math.round((correct / Math.min(words.length, ROUNDS)) * 100));
    }
  }, [phase]);

  const handlePlayAgain = () => {
    setRound(0);
    setScore(0);
    setCorrect(0);
    setPhase('playing');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="text-4xl">🔨</motion.div>
      </div>
    );
  }

  if (words.length < 4) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-muted-foreground mb-4">Need at least 4 words to play Mole Whacker!</p>
        <Button onClick={() => navigate('/games')}>Back to Games</Button>
      </div>
    );
  }

  if (phase === 'finished') {
    return <GameResults score={score} total={Math.min(words.length, ROUNDS)} correct={correct} gameType="mole-whacker" onPlayAgain={handlePlayAgain} />;
  }

  return (
    <div style={{ cursor: 'url("data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 24 24%22><text y=%2220%22 font-size=%2220%22>🔨</text></svg>") 16 16, auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/games')} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="text-center">
          <span className="text-sm text-muted-foreground">Round {round + 1}/{Math.min(words.length, ROUNDS)}</span>
          <span className="ml-4 font-display font-bold text-primary">{score} pts</span>
        </div>
      </div>

      {/* Listen prompt */}
      <div className="text-center mb-6">
        <p className="text-lg font-display font-bold text-foreground mb-2">🎧 Listen and whack the right mole!</p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full gap-2"
          onClick={() => targetWord && speakWord(targetWord.word)}
        >
          <Volume2 className="w-4 h-4" /> Listen Again
        </Button>
      </div>

      {/* 2x2 Mole Grid */}
      <div
        ref={gridRef}
        className="relative grid grid-cols-2 gap-6 max-w-md mx-auto p-6 rounded-3xl"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--mint)) 0%, hsl(120, 30%, 55%) 100%)',
        }}
      >
        {starPos && <StarBurst x={starPos.x} y={starPos.y} />}

        {[0, 1, 2, 3].map(holeIdx => {
          const mole = moles.find(m => m.holeIndex === holeIdx);
          const isHit = mole && hitIndex !== null && moles[hitIndex]?.holeIndex === holeIdx;
          const isWrong = mole && wrongIndex !== null && moles[wrongIndex]?.holeIndex === holeIdx;

          return (
            <div key={holeIdx} className="flex flex-col items-center">
              {/* Mole area */}
              <div
                className="relative w-28 h-36 sm:w-32 sm:h-40 flex flex-col items-center justify-end overflow-hidden"
                onClick={(e) => {
                  const mIdx = moles.findIndex(m => m.holeIndex === holeIdx);
                  if (mIdx >= 0 && moles[mIdx].visible) handleWhack(mIdx, e);
                }}
              >
                <AnimatePresence>
                  {mole && mole.visible && (
                    <motion.div
                      key={`mole-${holeIdx}`}
                      initial={{ y: 80 }}
                      animate={{
                        y: isHit ? [0, -5, 5, -3, 3, 0] : isWrong ? [0, -8, 8, -4, 4, 0] : 0,
                      }}
                      exit={{ y: 80 }}
                      transition={{
                        y: isHit || isWrong
                          ? { duration: 0.4, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }
                          : { type: 'spring', stiffness: 300, damping: 20 },
                      }}
                      className="absolute bottom-0 flex flex-col items-center cursor-pointer select-none"
                    >
                      {/* Word label */}
                      <motion.div
                        className={`px-3 py-1 rounded-xl text-sm font-bold mb-1 text-center whitespace-nowrap ${
                          isHit
                            ? 'bg-green-500 text-white'
                            : isWrong
                            ? 'bg-red-500 text-white'
                            : 'bg-card text-foreground border border-border'
                        }`}
                        animate={isWrong ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                        transition={{ duration: 0.4 }}
                      >
                        {mole.word.word}
                      </motion.div>
                      {/* Mole image */}
                      <motion.img
                        src={moleImg}
                        alt="Mole"
                        className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-lg"
                        animate={
                          isHit
                            ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 0.9, 1.1, 0.95, 1] }
                            : {}
                        }
                        transition={{ duration: 0.5 }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Hole */}
              <div
                className="w-28 h-6 sm:w-32 sm:h-7 rounded-[50%] -mt-2"
                style={{
                  background: 'radial-gradient(ellipse, hsl(30, 40%, 25%) 0%, hsl(30, 30%, 35%) 60%, transparent 100%)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Hammer active flash */}
      <AnimatePresence>
        {hammerActive && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-white/10 pointer-events-none z-50"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MoleWhackerGame;
