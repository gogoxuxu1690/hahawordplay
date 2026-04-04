import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameWords, useRecordResult, GameWord } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';
import { LandscapePrompt } from '@/components/LandscapePrompt';
import moleImg from '@/assets/mole.png';

const ROUNDS = 10;
const BASE_VISIBLE_MS = 3000;
const SPEED_INCREASE = 150; // ms faster per correct answer

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

function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/* ── Whack sound ── */
function playWhackSound(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
}

/* ── StarBurst ── */
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
          className="absolute text-lg"
          style={{ left: -8, top: -8, color: 'hsl(var(--warning))' }}
        >
          ⭐
        </motion.div>
      ))}
    </div>
  );
};

/* ── Orbiting stars (dizziness) ── */
const DizzyStars = () => (
  <motion.div
    className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-16 pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {[0, 1, 2, 3].map(i => (
      <motion.span
        key={i}
        className="absolute text-sm"
        style={{ left: '50%', top: '50%' }}
        animate={{
          x: [
            Math.cos((i / 4) * Math.PI * 2) * 20,
            Math.cos((i / 4) * Math.PI * 2 + Math.PI) * 20,
            Math.cos((i / 4) * Math.PI * 2 + Math.PI * 2) * 20,
          ],
          y: [
            Math.sin((i / 4) * Math.PI * 2) * 12,
            Math.sin((i / 4) * Math.PI * 2 + Math.PI) * 12,
            Math.sin((i / 4) * Math.PI * 2 + Math.PI * 2) * 12,
          ],
        }}
        transition={{ duration: 0.8, repeat: 1 }}
      >
        ⭐
      </motion.span>
    ))}
  </motion.div>
);

type MoleState = {
  word: GameWord;
  holeIndex: number;
  visible: boolean;
  timerId?: ReturnType<typeof setTimeout>;
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
  const [moles, setMoles] = useState<MoleState[]>([]);
  const [targetWord, setTargetWord] = useState<GameWord | null>(null);
  const [whackingHole, setWhackingHole] = useState<number | null>(null);
  const [whackHit, setWhackHit] = useState(0); // 0, 1, 2
  const [dizzyHole, setDizzyHole] = useState<number | null>(null);
  const [wrongHole, setWrongHole] = useState<number | null>(null);
  const [starPos, setStarPos] = useState<{ x: number; y: number } | null>(null);
  const [canHit, setCanHit] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const emergenceTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const visibleDuration = useCallback(() => {
    return Math.max(1500, BASE_VISIBLE_MS - correct * SPEED_INCREASE);
  }, [correct]);

  const clearAllTimers = useCallback(() => {
    emergenceTimers.current.forEach(t => clearTimeout(t));
    emergenceTimers.current = [];
  }, []);

  /* ── Dynamic emergence: moles pop up/down randomly ── */
  const setupRound = useCallback((roundIdx: number) => {
    if (roundIdx >= words.length || roundIdx >= ROUNDS) {
      setPhase('finished');
      return;
    }
    clearAllTimers();

    const target = words[roundIdx];
    setTargetWord(target);
    setWhackingHole(null);
    setWhackHit(0);
    setDizzyHole(null);
    setWrongHole(null);
    setStarPos(null);
    setCanHit(true);

    const others = words.filter(w => w.id !== target.id);
    const distractors = shuffle(others).slice(0, 3);
    const options = shuffle([target, ...distractors]);
    const holeAssignments = shuffle([0, 1, 2, 3]);

    const initialMoles: MoleState[] = options.map((w, i) => ({
      word: w,
      holeIndex: holeAssignments[i],
      visible: false,
    }));
    setMoles(initialMoles);

    // Speak the word
    setTimeout(() => speakWord(target.word), 300);

    // Dynamic emergence: stagger moles with random delays
    const dur = Math.max(1500, BASE_VISIBLE_MS - roundIdx * (SPEED_INCREASE / 2));
    initialMoles.forEach((mole, i) => {
      const emergeDelay = randomDelay(400, 1200) + i * 200;
      const t = setTimeout(() => {
        // Show mole
        setMoles(prev => prev.map((m, idx) => idx === i ? { ...m, visible: true } : m));
        // Schedule retreat
        const retreatTimer = setTimeout(() => {
          setMoles(prev => prev.map((m, idx) => idx === i ? { ...m, visible: false } : m));
          // Re-emerge after a pause (if round is still active)
          const reEmerge = setTimeout(() => {
            setMoles(prev => prev.map((m, idx) => idx === i ? { ...m, visible: true } : m));
            // Final retreat
            const finalRetreat = setTimeout(() => {
              setMoles(prev => prev.map((m, idx) => idx === i ? { ...m, visible: false } : m));
            }, dur);
            emergenceTimers.current.push(finalRetreat);
          }, randomDelay(600, 1200));
          emergenceTimers.current.push(reEmerge);
        }, dur);
        emergenceTimers.current.push(retreatTimer);
      }, emergeDelay);
      emergenceTimers.current.push(t);
    });

    // Failsafe: auto-advance if no answer after full cycle
    const failsafe = setTimeout(() => {
      setMoles(prev => prev.map(m => ({ ...m, visible: false })));
      setTimeout(() => {
        setCanHit(false);
        recordResult(target.id, false);
        setRound(r => r + 1);
      }, 500);
    }, dur * 2 + 2500);
    emergenceTimers.current.push(failsafe);
  }, [words, recordResult, clearAllTimers]);

  useEffect(() => {
    if (!loading && words.length > 0 && phase === 'playing') {
      setupRound(round);
    }
    return () => clearAllTimers();
  }, [round, loading, words.length, phase]);

  /* ── Double-whack sequence ── */
  const handleWhack = (moleIdx: number, e: React.MouseEvent) => {
    if (!canHit || !targetWord) return;
    setCanHit(false);
    clearAllTimers();

    const mole = moles[moleIdx];
    const holeIdx = mole.holeIndex;
    const isCorrect = mole.word.id === targetWord.id;

    // Freeze mole in place
    setWhackingHole(holeIdx);

    const ctx = getAudioCtx();

    // Hit 1
    setWhackHit(1);
    playWhackSound(ctx);

    setTimeout(() => {
      // Hit 2
      setWhackHit(2);
      playWhackSound(ctx);

      setTimeout(() => {
        // After double whack completes
        setWhackingHole(null);
        setWhackHit(0);

        if (isCorrect) {
          setDizzyHole(holeIdx);
          const rect = gridRef.current?.getBoundingClientRect();
          if (rect) {
            setStarPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }
          playCorrect();
          setScore(s => s + 10);
          setCorrect(c => c + 1);
          recordResult(targetWord.id, true);

          setTimeout(() => {
            setDizzyHole(null);
            setMoles(prev => prev.map(m => ({ ...m, visible: false })));
            setTimeout(() => setRound(r => r + 1), 400);
          }, 1200);
        } else {
          setWrongHole(holeIdx);
          playWrong();
          recordResult(targetWord.id, false);

          setTimeout(() => {
            setWrongHole(null);
            setMoles(prev => prev.map(m => ({ ...m, visible: false })));
            setTimeout(() => setRound(r => r + 1), 400);
          }, 800);
        }
      }, 180);
    }, 180);
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
    <>
    <LandscapePrompt />
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
          const isBeingWhacked = whackingHole === holeIdx;
          const isDizzy = dizzyHole === holeIdx;
          const isWrong = wrongHole === holeIdx;

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
                        y: isBeingWhacked
                          ? (whackHit === 1 ? [0, 6, 0] : whackHit === 2 ? [0, 8, 0] : 0)
                          : isDizzy
                          ? [0, -3, 3, -2, 2, 0]
                          : isWrong
                          ? [0, -8, 8, -4, 4, 0]
                          : 0,
                      }}
                      exit={{ y: 80 }}
                      transition={{
                        y: isBeingWhacked || isDizzy || isWrong
                          ? { duration: 0.15, times: isBeingWhacked ? [0, 0.5, 1] : [0, 0.2, 0.4, 0.6, 0.8, 1] }
                          : { type: 'spring', stiffness: 300, damping: 20 },
                      }}
                      className="absolute bottom-0 flex flex-col items-center cursor-pointer select-none"
                    >
                      {/* Dizzy stars orbiting */}
                      <AnimatePresence>
                        {isDizzy && <DizzyStars />}
                      </AnimatePresence>

                      {/* Word label attached to mole */}
                      <motion.div
                        className={`px-3 py-1 rounded-xl text-sm font-bold mb-1 text-center whitespace-nowrap ${
                          isDizzy
                            ? 'bg-green-500 text-white'
                            : isWrong
                            ? 'bg-red-500 text-white'
                            : isBeingWhacked
                            ? 'bg-amber-400 text-foreground border border-border'
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
                          isBeingWhacked
                            ? { rotate: whackHit === 1 ? [0, -20, 0] : [0, 20, 0], scale: [1, 0.85, 1] }
                            : isDizzy
                            ? { rotate: [0, -10, 10, -5, 5, 0] }
                            : {}
                        }
                        transition={{ duration: 0.15 }}
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
    </div>
    </>
  );
};

export default MoleWhackerGame;
