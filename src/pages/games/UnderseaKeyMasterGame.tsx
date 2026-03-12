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

const KEY_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='8' cy='8' r='6' fill='none' stroke='%23FFD700' stroke-width='2'/%3E%3Ccircle cx='8' cy='8' r='2' fill='%23FFD700'/%3E%3Cline x1='14' y1='8' x2='28' y2='8' stroke='%23FFD700' stroke-width='2.5' stroke-linecap='round'/%3E%3Cline x1='24' y1='8' x2='24' y2='14' stroke='%23FFD700' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='28' y1='8' x2='28' y2='12' stroke='%23FFD700' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 8 8, auto`;

interface ChestItem {
  content: string;
  index: number;
  x: number;
  y: number;
  state: 'closed' | 'open-correct' | 'open-wrong' | 'open-peek';
  revealed: boolean;
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
      content, index,
      x: (col + 0.5) * cellW + (Math.random() - 0.5) * 30,
      y: 120 + (row + 0.5) * cellH + (Math.random() - 0.5) * 20,
      state: 'closed' as const,
      revealed: false,
    };
  });
}

const UnderseaKeyMasterGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isGrammar = !!searchParams.get('grammar_groups');

  const { words, loading: wordsLoading } = useGameWords(isGrammar ? 0 : 20);
  const { pairs, loading: pairsLoading } = useGrammarPairs(isGrammar ? 10 : 0);
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();

  const loading = isGrammar ? pairsLoading : wordsLoading;

  // Build puzzle items
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
  const [collected, setCollected] = useState<string[]>([]);
  const [nextExpected, setNextExpected] = useState(0);
  const [showWrongFace, setShowWrongFace] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [processing, setProcessing] = useState(false);

  const bgmRef = useRef<HTMLAudioElement | null>(null);

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

  // Setup round
  useEffect(() => {
    if (!currentPuzzle || !gameStarted) return;
    // Shuffle pieces for chest placement
    const shuffled = [...currentPuzzle.pieces].sort(() => Math.random() - 0.5);
    setChests(scatterChests(shuffled));
    setCollected([]);
    setNextExpected(0);
    setShowVictory(false);
  }, [currentIdx, currentPuzzle, gameStarted]);

  const handleChestClick = useCallback((chest: ChestItem) => {
    if (chest.state === 'open-correct' || processing) return;
    const expected = currentPuzzle?.pieces[nextExpected];
    if (!expected) return;

    setProcessing(true);
    duckBgm();

    if (chest.content.toLowerCase() === expected.toLowerCase()) {
      // Correct!
      playCorrect();
      setChests(prev => prev.map(c => c.index === chest.index ? { ...c, state: 'open-correct', revealed: true } : c));
      setCollected(prev => [...prev, chest.content]);
      const newNext = nextExpected + 1;
      setNextExpected(newNext);
      setProcessing(false);

      if (newNext === currentPuzzle!.pieces.length) {
        if (!isGrammar) recordResult(currentPuzzle!.id, true);
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
      // Wrong — show content briefly, show haha face, then close
      playWrong();
      if (!isGrammar) recordResult(currentPuzzle!.id, false);
      setChests(prev => prev.map(c => c.index === chest.index ? { ...c, state: 'open-peek' } : c));
      setShowWrongFace(true);
      setTimeout(() => {
        setShowWrongFace(false);
        setChests(prev => prev.map(c => c.index === chest.index ? { ...c, state: 'closed' } : c));
        setProcessing(false);
      }, 2000);
    }
  }, [currentPuzzle, nextExpected, processing, duckBgm, playCorrect, playWrong, recordResult, isGrammar, currentIdx, puzzles.length, correctCount, score, saveSession, playFinish]);

  if (!gameStarted) {
    return (
      <div className="relative min-h-[80vh] flex flex-col items-center justify-center overflow-hidden rounded-2xl">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" src="/media/sea.mp4" />
        <div className="absolute inset-0 bg-black/40" />
        <motion.div className="relative z-10 flex flex-col items-center gap-6 p-8 rounded-3xl bg-black/30 backdrop-blur-md border border-white/10" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl">🔑</div>
          <h1 className="text-3xl font-display font-bold text-cyan-300 drop-shadow-lg">Undersea Key Master</h1>
          <p className="text-white/80 text-center max-w-sm">Use your golden key to unlock treasure chests! Find the right pieces in order, but remember what's inside — wrong chests close again!</p>
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
    <div className="relative min-h-[80vh] overflow-hidden rounded-2xl select-none" style={{ cursor: KEY_CURSOR }}>
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" src="/media/sea.mp4" />
      <div className="absolute inset-0 bg-blue-900/30" />

      {/* Controls */}
      <div className="absolute top-4 left-4 z-40 flex gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/games')} className="bg-black/30 text-white hover:bg-black/50"><ArrowLeft className="w-5 h-5" /></Button>
        <Button variant="ghost" size="icon" onClick={toggleBgm} className="bg-black/30 text-white hover:bg-black/50">
          {bgmPlaying ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      <div className="absolute top-4 right-4 z-40 px-4 py-2 rounded-xl bg-black/40 backdrop-blur text-cyan-300 font-bold">
        🔑 {score} &nbsp;|&nbsp; {currentIdx + 1}/{puzzles.length}
      </div>

      {/* Collection bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-4 py-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/20 min-w-[200px] flex-wrap">
        {currentPuzzle && currentPuzzle.pieces.map((_, i) => (
          <motion.span key={i} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-bold"
            style={{
              background: collected[i] ? 'linear-gradient(135deg, #00CED1, #0099CC)' : 'rgba(255,255,255,0.1)',
              color: collected[i] ? '#fff' : 'rgba(255,255,255,0.3)',
              border: collected[i] ? '2px solid #00CED1' : '1px dashed rgba(255,255,255,0.2)',
              minWidth: 36,
            }}
            initial={collected[i] ? { scale: 0 } : {}}
            animate={collected[i] ? { scale: 1 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            {collected[i] || '?'}
          </motion.span>
        ))}
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 px-6 py-2 rounded-xl bg-black/40 backdrop-blur text-white/80 text-sm font-medium">
        🔍 Find: <span className="text-cyan-300 font-bold">{currentPuzzle?.hint}</span>
      </div>

      {/* Chests */}
      <div className="relative z-20 w-full h-full" style={{ minHeight: '70vh' }}>
        <AnimatePresence>
          {chests.map(chest => (
            <motion.div
              key={`${currentIdx}-${chest.index}`}
              className="absolute flex flex-col items-center"
              style={{ left: chest.x - 40, top: chest.y, cursor: KEY_CURSOR }}
              initial={{ scale: 0, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', delay: chest.index * 0.05 }}
              onClick={() => handleChestClick(chest)}
            >
              <AnimatePresence mode="wait">
                {(chest.state === 'open-correct' || chest.state === 'open-peek') && (
                  <motion.div
                    key="content"
                    className="mb-1 px-3 py-1 rounded-lg font-bold text-sm"
                    style={{
                      background: chest.state === 'open-correct'
                        ? 'linear-gradient(135deg, #00CED1, #0099CC)'
                        : 'linear-gradient(135deg, #FF6B6B, #ee5a24)',
                      color: '#fff',
                    }}
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0, y: 10 }}
                  >
                    {chest.content}
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.img
                src={chestImg}
                alt="chest"
                className="w-20 h-16 object-contain drop-shadow-lg"
                style={{
                  filter: chest.state === 'open-correct' ? 'brightness(1.3) saturate(0.5)' : 'none',
                  opacity: chest.state === 'open-correct' ? 0.5 : 1,
                }}
                animate={{
                  rotate: chest.state === 'open-peek' ? [0, -5, 5, -5, 0] : 0,
                }}
                transition={{ duration: 0.4 }}
                whileHover={{ scale: chest.state === 'closed' ? 1.1 : 1, y: chest.state === 'closed' ? -5 : 0 }}
                whileTap={{ scale: 0.9 }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Wrong face overlay */}
      <AnimatePresence>
        {showWrongFace && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative"
              animate={{ rotate: [0, -15, 15, -15, 15, 0] }}
              transition={{ duration: 1, repeat: 1 }}
            >
              <img src={hahaImg} alt="wrong" className="w-32 h-32 rounded-full object-cover border-4 border-red-400 shadow-2xl" />
              <motion.div
                className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-1 rounded-full font-bold text-sm whitespace-nowrap"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
              >
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
