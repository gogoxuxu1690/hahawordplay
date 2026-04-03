import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useGameWords } from '@/hooks/useGameWords';
import { useGrammarPairs } from '@/hooks/useGrammarPairs';
import { useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds, getGlobalMuted } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';
import chestImg from '@/assets/chest.png';
import hahaImg from '@/assets/haha.jpg';

const BGM_FULL = 0.3;
const BGM_DUCK = 0.08;
const SPARKLE_LIFETIME = 800;

const KEY_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='8' cy='8' r='6' fill='none' stroke='%23FFD700' stroke-width='2'/%3E%3Ccircle cx='8' cy='8' r='2' fill='%23FFD700'/%3E%3Cline x1='14' y1='8' x2='28' y2='8' stroke='%23FFD700' stroke-width='2.5' stroke-linecap='round'/%3E%3Cline x1='24' y1='8' x2='24' y2='14' stroke='%23FFD700' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='28' y1='8' x2='28' y2='12' stroke='%23FFD700' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 8 8, auto`;

interface Sparkle { id: number; x: number; y: number; born: number; color: string; }

interface ChestItem {
  content: string;
  index: number;
  x: number;
  y: number;
  state: 'closed' | 'open-correct' | 'open-wrong' | 'open-peek';
  revealed: boolean;
  hovered: boolean;
}

function scatterChests(items: string[]): ChestItem[] {
  const cols = Math.min(items.length, 5);
  const rows = Math.ceil(items.length / cols);
  const cellW = Math.min(window.innerWidth, 900) / (cols + 1);
  const cellH = Math.min(window.innerHeight - 250, 450) / (rows + 1);
  return items.map((content, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      content: content.toUpperCase(), index,
      x: (col + 0.5) * cellW + (Math.random() - 0.5) * 30,
      y: 120 + (row + 0.5) * cellH + (Math.random() - 0.5) * 20,
      state: 'closed' as const,
      revealed: false,
      hovered: false,
    };
  });
}

const SparkleTrail = ({ sparkles }: { sparkles: Sparkle[] }) => (
  <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
    {sparkles.map(s => {
      const age = (Date.now() - s.born) / SPARKLE_LIFETIME;
      return (
        <div key={s.id} className="absolute rounded-full" style={{
          left: s.x - 3, top: s.y - 3,
          width: 6 * (1 - age), height: 6 * (1 - age),
          background: s.color, opacity: 1 - age,
          boxShadow: `0 0 ${5 + 3 * (1 - age)}px ${s.color}`,
        }} />
      );
    })}
  </div>
);

const SlotBar = ({ slots, total, onDropSlot }: { slots: (string | null)[]; total: number; onDropSlot: (slotIdx: number) => void }) => (
  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-4 py-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/20 min-w-[200px] flex-wrap">
    {Array.from({ length: total }).map((_, i) => (
      <motion.div
        key={i}
        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-bold"
        style={{
          background: slots[i] ? 'linear-gradient(135deg, #00CED1, #0099CC)' : 'rgba(255,255,255,0.1)',
          color: slots[i] ? '#fff' : 'rgba(255,255,255,0.3)',
          border: slots[i] ? '2px solid #00CED1' : '1px dashed rgba(255,255,255,0.2)',
          minWidth: 36,
        }}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(0,206,209,0.6)'; }}
        onDragLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
        onDrop={e => {
          e.preventDefault();
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
          onDropSlot(i);
        }}
        initial={slots[i] ? { scale: 0 } : {}}
        animate={slots[i] ? { scale: 1 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        {slots[i] || '?'}
      </motion.div>
    ))}
  </div>
);

const UnderseaKeyMasterGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isGrammar = !!searchParams.get('grammar_groups');

  const { words, loading: wordsLoading } = useGameWords(isGrammar ? 0 : 20);
  const { pairs, loading: pairsLoading } = useGrammarPairs(isGrammar ? 10 : 0);
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();

  const loading = isGrammar ? pairsLoading : wordsLoading;

  const puzzles = useMemo(() => {
    if (isGrammar) {
      return pairs.map(p => ({
        id: p.id,
        pieces: p.answer.split(/\s+/),
        hint: p.question,
      }));
    }
    return words.map(w => ({
      id: w.id,
      pieces: w.word.split(''),
      hint: w.description || `${w.word.length} letters`,
    }));
  }, [isGrammar, words, pairs]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [chests, setChests] = useState<ChestItem[]>([]);
  const [slots, setSlots] = useState<(string | null)[]>([]);
  const [showWrongFace, setShowWrongFace] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [draggedChestIndex, setDraggedChestIndex] = useState<number | null>(null);

  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const sparkleId = useRef(0);
  const animFrameRef = useRef<number>(0);

  const currentPuzzle = puzzles[currentIdx];

  useEffect(() => {
    const audio = new Audio('/media/garden-bgm.mp3');
    audio.loop = true; audio.volume = BGM_FULL;
    bgmRef.current = audio;
    return () => { audio.pause(); audio.src = ''; };
  }, []);

  const toggleBgm = useCallback(() => {
    if (!bgmRef.current) return;
    if (bgmPlaying) bgmRef.current.pause();
    else bgmRef.current.play().catch(() => {});
    setBgmPlaying(!bgmPlaying);
  }, [bgmPlaying]);

  const duckBgm = useCallback(() => {
    if (bgmRef.current && bgmPlaying) {
      bgmRef.current.volume = BGM_DUCK;
      setTimeout(() => { if (bgmRef.current) bgmRef.current.volume = BGM_FULL; }, 1500);
    }
  }, [bgmPlaying]);

  useEffect(() => {
    const tick = () => {
      setSparkles(prev => prev.filter(s => Date.now() - s.born < SPARKLE_LIFETIME));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (getGlobalMuted()) return;
    const colors = ['#FFD700', '#00CED1', '#FFA500', '#FFFACD'];
    setSparkles(prev => [...prev.slice(-30), {
      id: sparkleId.current++, x: e.clientX, y: e.clientY, born: Date.now(),
      color: colors[Math.floor(Math.random() * colors.length)],
    }]);
  }, []);

  useEffect(() => {
    if (!currentPuzzle || !gameStarted) return;
    const shuffled = [...currentPuzzle.pieces].sort(() => Math.random() - 0.5);
    setChests(scatterChests(shuffled));
    setSlots(new Array(currentPuzzle.pieces.length).fill(null));
    setShowVictory(false);
    setDraggedChestIndex(null);
  }, [currentIdx, currentPuzzle, gameStarted]);

  const handleChestHover = useCallback((index: number, hovered: boolean) => {
    setChests(prev => prev.map(c => c.index === index ? { ...c, hovered } : c));
  }, []);

  const handleChestClick = useCallback((chest: ChestItem) => {
    if (chest.state === 'open-correct' || processing) return;
    setChests(prev => prev.map(c => c.index === chest.index ? { ...c, state: 'open-peek', revealed: true } : c));
  }, [processing]);

  const handleLetterDragStart = useCallback((e: React.DragEvent, chest: ChestItem) => {
    if (chest.state === 'open-correct' || processing) {
      e.preventDefault();
      return;
    }
    // Open the chest to show content
    setChests(prev => prev.map(c => c.index === chest.index ? { ...c, state: 'open-peek', revealed: true } : c));
    setDraggedChestIndex(chest.index);

    // Create a drag ghost showing ONLY the letter
    const ghost = document.createElement('div');
    ghost.style.cssText = 'width:44px;height:36px;background:linear-gradient(135deg,#00CED1,#0099CC);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;color:white;position:absolute;top:-200px;';
    ghost.textContent = chest.content;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 22, 18);
    setTimeout(() => document.body.removeChild(ghost), 0);
    e.dataTransfer.effectAllowed = 'move';
  }, [processing]);

  const handleDropSlot = useCallback((slotIdx: number) => {
    if (draggedChestIndex === null || !currentPuzzle || processing) return;
    const draggedChest = chests.find(c => c.index === draggedChestIndex);
    if (!draggedChest) return;

    setProcessing(true);
    duckBgm();

    const expected = currentPuzzle.pieces[slotIdx]?.toUpperCase();
    if (draggedChest.content.toUpperCase() === expected && !slots[slotIdx]) {
      playCorrect();
      setChests(prev => prev.map(c => c.index === draggedChest.index ? { ...c, state: 'open-correct' } : c));
      const newSlots = [...slots];
      newSlots[slotIdx] = draggedChest.content.toUpperCase();
      setSlots(newSlots);
      setProcessing(false);

      const filledCount = newSlots.filter(Boolean).length;
      if (filledCount === currentPuzzle.pieces.length) {
        if (!isGrammar) recordResult(currentPuzzle.id, true);
        setScore(s => s + 10);
        setCorrectCount(c => c + 1);
        setShowVictory(true);
        setTimeout(() => {
          setShowVictory(false);
          if (currentIdx + 1 < puzzles.length) {
            setCurrentIdx(i => i + 1);
          } else {
            const pct = Math.round(((correctCount + 1) / puzzles.length) * 100);
            saveSession('undersea-key-master', score + 10, puzzles.length, correctCount + 1);
            playFinish(pct);
            setFinished(true);
          }
        }, 2500);
      }
    } else {
      playWrong();
      if (!isGrammar) recordResult(currentPuzzle.id, false);
      setShowWrongFace(true);
      setTimeout(() => {
        setShowWrongFace(false);
        // Close the chest — memory mechanic
        setChests(prev => prev.map(c =>
          c.index === draggedChest.index && c.state !== 'open-correct'
            ? { ...c, state: 'closed' }
            : c
        ));
        setProcessing(false);
      }, 2000);
    }
    setDraggedChestIndex(null);
  }, [draggedChestIndex, chests, currentPuzzle, slots, processing, duckBgm, playCorrect, playWrong, recordResult, isGrammar, currentIdx, puzzles.length, correctCount, score, saveSession, playFinish]);

  const handleDragEnd = useCallback(() => {
    // If letter was dropped outside any slot, close the chest
    if (draggedChestIndex !== null) {
      setChests(prev => prev.map(c =>
        c.index === draggedChestIndex && c.state === 'open-peek'
          ? { ...c, state: 'closed' }
          : c
      ));
      setDraggedChestIndex(null);
    }
  }, [draggedChestIndex]);

  if (!gameStarted) {
    return (
      <div className="relative min-h-[80vh] flex flex-col items-center justify-center overflow-hidden rounded-2xl">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" src="/media/sea.mp4" />
        <div className="absolute inset-0 bg-black/40" />
        <motion.div className="relative z-10 flex flex-col items-center gap-6 p-8 rounded-3xl bg-black/30 backdrop-blur-md border border-white/10" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl">🔑</div>
          <h1 className="text-3xl font-display font-bold text-cyan-300 drop-shadow-lg">Undersea Key Master</h1>
          <p className="text-white/80 text-center max-w-sm">Use your golden key to unlock treasure chests! Click to peek, then drag the letter to the correct slot. Wrong guesses close the chest — remember what was inside!</p>
          <Button onClick={() => { setGameStarted(true); bgmRef.current?.play().catch(() => {}); setBgmPlaying(true); }}
            className="px-8 py-3 text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 text-white rounded-xl hover:from-cyan-300 hover:to-blue-400">
            🔑 Start Diving
          </Button>
          <Button variant="ghost" onClick={() => navigate('/games')} className="text-white/60 hover:text-white"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </motion.div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Diving deep...</div>;
  if (puzzles.length < 1) return <div className="text-center py-20 text-muted-foreground">Need at least 1 item to play!</div>;

  if (finished) {
    return <GameResults score={score} total={puzzles.length} correct={correctCount} gameType="undersea-key-master" onPlayAgain={() => { setCurrentIdx(0); setScore(0); setCorrectCount(0); setFinished(false); }} />;
  }

  return (
    <div className="relative min-h-[80vh] overflow-hidden rounded-2xl select-none" style={{ cursor: KEY_CURSOR }} onMouseMove={handleMouseMove}>
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" src="/media/sea.mp4" />
      <div className="absolute inset-0 bg-blue-900/30" />

      <div className="absolute top-4 left-4 z-40 flex gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/games')} className="bg-black/30 text-white hover:bg-black/50"><ArrowLeft className="w-5 h-5" /></Button>
        <Button variant="ghost" size="icon" onClick={toggleBgm} className="bg-black/30 text-white hover:bg-black/50">
          {bgmPlaying ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      <div className="absolute top-4 right-4 z-40 px-4 py-2 rounded-xl bg-black/40 backdrop-blur text-cyan-300 font-bold">
        🔑 {score} &nbsp;|&nbsp; {currentIdx + 1}/{puzzles.length}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 px-6 py-2 rounded-xl bg-black/40 backdrop-blur text-white/80 text-sm font-medium">
        🔍 Find: <span className="text-cyan-300 font-bold">{currentPuzzle?.hint}</span>
      </div>

      <SlotBar slots={slots} total={currentPuzzle?.pieces.length || 0} onDropSlot={handleDropSlot} />

      {/* Chests - stationary, only letter drags */}
      <div className="relative z-20 w-full h-full" style={{ minHeight: '70vh' }}>
        <AnimatePresence>
          {chests.map(chest => {
            const isBeingDragged = draggedChestIndex === chest.index;
            return (
              <motion.div
                key={`${currentIdx}-${chest.index}`}
                className="absolute flex flex-col items-center"
                style={{ left: chest.x - 40, top: chest.y, cursor: KEY_CURSOR }}
                initial={{ scale: 0, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', delay: chest.index * 0.05 }}
                onMouseEnter={() => handleChestHover(chest.index, true)}
                onMouseLeave={() => handleChestHover(chest.index, false)}
                onClick={() => handleChestClick(chest)}
              >
                {/* Letter label - this is the draggable part */}
                <AnimatePresence mode="wait">
                  {(chest.state === 'open-correct' || chest.state === 'open-peek') && !isBeingDragged && (
                    <motion.div
                      key="content"
                      className="mb-1 px-3 py-1 rounded-lg font-bold text-sm"
                      style={{
                        background: chest.state === 'open-correct'
                          ? 'linear-gradient(135deg, #00CED1, #0099CC)'
                          : 'linear-gradient(135deg, #FF6B6B, #ee5a24)',
                        color: '#fff',
                        cursor: chest.state === 'open-correct' ? 'default' : 'grab',
                      }}
                      initial={{ scale: 0, y: 10 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0, y: 10 }}
                      draggable={chest.state !== 'open-correct'}
                      onDragStart={(e) => handleLetterDragStart(e as unknown as React.DragEvent, chest)}
                      onDragEnd={handleDragEnd}
                    >
                      {chest.content}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chest image - NOT draggable, stays stationary */}
                <motion.img
                  src={chestImg}
                  alt="chest"
                  className="w-20 h-16 object-contain drop-shadow-lg"
                  style={{
                    filter: chest.state === 'open-correct'
                      ? 'brightness(1.3) saturate(0.5)'
                      : chest.hovered ? 'none' : 'blur(2px) brightness(0.7)',
                    opacity: chest.state === 'open-correct' ? 0.5 : chest.hovered ? 1 : 0.5,
                    transition: 'filter 0.3s, opacity 0.3s',
                  }}
                  animate={{
                    rotate: chest.state === 'open-peek' ? [0, -5, 5, -5, 0] : 0,
                  }}
                  transition={{ duration: 0.4 }}
                  whileHover={{ scale: chest.state === 'closed' ? 1.1 : 1, y: chest.state === 'closed' ? -5 : 0 }}
                  whileTap={{ scale: 0.9 }}
                  draggable={false}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <SparkleTrail sparkles={sparkles} />

      {/* Wrong face overlay */}
      <AnimatePresence>
        {showWrongFace && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="relative" animate={{ rotate: [0, -15, 15, -15, 15, 0] }} transition={{ duration: 1, repeat: 1 }}>
              <img src={hahaImg} alt="wrong" className="w-32 h-32 rounded-full object-cover border-4 border-red-400 shadow-2xl" />
              <motion.div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-1 rounded-full font-bold text-sm whitespace-nowrap" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                Lêu lêu! 😜
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Victory overlay */}
      <AnimatePresence>
        {showVictory && (
          <motion.div className="fixed inset-0 z-50 flex flex-col items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50" />
            <motion.div className="relative z-10 flex flex-col items-center" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
              <div className="text-8xl mb-4">🏆</div>
              <div className="text-4xl font-display font-bold text-cyan-300 drop-shadow-lg">✨ Unlocked! ✨</div>
              {Array.from({ length: 15 }).map((_, i) => {
                const angle = (i / 15) * Math.PI * 2;
                const dist = 80 + Math.random() * 100;
                return (
                  <motion.div key={i} className="absolute text-2xl"
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0 }}
                    transition={{ duration: 1.5, delay: Math.random() * 0.3 }}
                  >
                    {['🐟', '🐠', '🐙', '🦀', '⭐'][i % 5]}
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UnderseaKeyMasterGame;
