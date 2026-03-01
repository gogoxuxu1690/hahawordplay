import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';
import woodpeckerImg from '@/assets/gokien.png';

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

function playKnockSound(ctx: AudioContext, delay: number) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.04);
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.06);

  // noise burst for wood texture
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.3, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  noise.connect(ng);
  ng.connect(ctx.destination);
  noise.start(t);
}

function playPopSound(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

function speakLeuLeu() {
  const u = new SpeechSynthesisUtterance('Lêu lêu');
  u.lang = 'vi-VN';
  u.pitch = 1.5;
  u.rate = 1.2;
  speechSynthesis.speak(u);
}

const WoodpeckerGame = () => {
  const { words, loading } = useGameWords();
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playFinish } = useGameSounds();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [caterpillars, setCaterpillars] = useState<Caterpillar[]>([]);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [pecking, setPecking] = useState(false);
  const [peckedId, setPeckedId] = useState<string | null>(null);
  const [wiggleId, setWiggleId] = useState<string | null>(null);
  const [popId, setPopId] = useState<string | null>(null);

  // Custom cursor state
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [peckAngle, setPeckAngle] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

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
    setPeckedId(null);
    setWiggleId(null);
    setPopId(null);
    setPecking(false);
  }, [currentIndex, current, finished]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const doPeckAnimation = (): Promise<void> => {
    return new Promise((resolve) => {
      const ctx = getAudioCtx();
      // 3 knocks at ~100ms intervals
      playKnockSound(ctx, 0);
      playKnockSound(ctx, 0.12);
      playKnockSound(ctx, 0.24);

      let count = 0;
      const peck = () => {
        setPeckAngle(30);
        setTimeout(() => {
          setPeckAngle(0);
          count++;
          if (count < 3) setTimeout(peck, 60);
          else resolve();
        }, 60);
      };
      peck();
    });
  };

  const handlePeck = async (cat: Caterpillar) => {
    if (pecking || !current) return;
    setPecking(true);
    setPeckedId(cat.id);

    // Pecking animation first
    await doPeckAnimation();

    const correct = cat.id === current.id;
    await recordResult(current.id, correct);
    const newResults = [...results, correct];
    setResults(newResults);

    if (correct) {
      // Pop + disappear
      setPopId(cat.id);
      playPopSound(getAudioCtx());
      setTimeout(() => playCorrect(), 150);
    } else {
      // Wiggle + "Lêu lêu"
      setWiggleId(cat.id);
      speakLeuLeu();
    }

    setTimeout(() => {
      if (currentIndex + 1 >= words.length) {
        const correctCount = newResults.filter(Boolean).length;
        saveSession('woodpecker', correctCount * 10, words.length, correctCount);
        playFinish();
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
    setPecking(false);
    setPeckedId(null);
    setWiggleId(null);
    setPopId(null);
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

      {/* Tree with holes + custom cursor */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setCursorVisible(true)}
        onMouseLeave={() => setCursorVisible(false)}
        className="relative rounded-2xl overflow-hidden border border-border select-none"
        style={{ height: 340, cursor: 'none', background: 'linear-gradient(to bottom, hsl(var(--muted) / 0.3), hsl(var(--muted) / 0.5))' }}
      >
        {/* Tree trunk visual */}
        <div className="absolute inset-x-1/3 inset-y-0 rounded-t-3xl bg-muted/30" />

        {/* Caterpillars in holes */}
        <AnimatePresence>
          {caterpillars.map((cat) => {
            const hole = HOLES[cat.holeIndex];
            const isPopped = cat.id === popId;
            const isWiggling = cat.id === wiggleId;
            if (isPopped) return null; // disappeared
            return (
              <motion.button
                key={cat.id}
                initial={{ x: -40, opacity: 0 }}
                animate={isWiggling ? {
                  x: [0, -10, 10, -10, 10, 0],
                  opacity: 1,
                  transition: { x: { duration: 0.5 }, opacity: { duration: 0.3 } }
                } : {
                  x: [0, 8, 0, -8, 0],
                  opacity: 1,
                }}
                transition={{
                  x: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                  opacity: { duration: 0.3 },
                }}
                exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
                onClick={() => handlePeck(cat)}
                disabled={pecking}
                className={`absolute flex items-center gap-1 px-3 py-2 rounded-full font-bold text-sm transition-all
                  ${isWiggling ? 'bg-destructive/20 text-destructive ring-2 ring-destructive' : ''}
                  ${peckedId === cat.id && cat.id === current.id ? 'bg-secondary text-secondary-foreground ring-2 ring-secondary' : ''}
                  ${peckedId !== cat.id && !isWiggling ? 'bg-card text-foreground game-card-shadow hover:scale-110 cursor-none' : ''}
                `}
                style={{ left: `${hole.x}%`, top: `${hole.y}%` }}
              >
                <span className="text-base">🐛</span>
                {cat.word}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Pop effect */}
        <AnimatePresence>
          {popId && (
            <motion.div
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex items-center justify-center text-5xl pointer-events-none"
            >
              💥
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom woodpecker cursor */}
        {cursorVisible && (
          <img
            src={woodpeckerImg}
            alt=""
            className="absolute pointer-events-none z-50"
            style={{
              width: 64,
              height: 64,
              objectFit: 'contain',
              left: cursorPos.x - 8, // beak tip offset (top-left area)
              top: cursorPos.y - 4,
              transform: `rotate(${peckAngle}deg)`,
              transformOrigin: '12% 8%', // pivot near beak
              transition: 'transform 0.05s ease-out',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default WoodpeckerGame;
