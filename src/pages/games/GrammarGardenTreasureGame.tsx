import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useGrammarPairs } from '@/hooks/useGrammarPairs';
import { useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds, getGlobalMuted } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';

const SPARKLE_LIFETIME = 1000;
const PIECE_SIZE = 80;
const BGM_FULL = 0.4;
const BGM_DUCK = 0.12;

interface Sparkle { id: number; x: number; y: number; born: number; color: string; }
interface Piece { word: string; index: number; x: number; y: number; found: boolean; hovered: boolean; asset: string; assetRotation: number; }

const GARDEN_ASSETS = ['🌳', '🌿', '🌺', '🌻', '🍀', '🌹', '🪴', '🌲', '🌾', '🪻', '🌸', '🍃'];

const WAND_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23FFD700'/%3E%3Cstop offset='100%25' stop-color='%23FFA500'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cline x1='4' y1='28' x2='20' y2='12' stroke='url(%23g)' stroke-width='3' stroke-linecap='round'/%3E%3Ccircle cx='22' cy='10' r='4' fill='%23FFD700'/%3E%3Cline x1='22' y1='2' x2='22' y2='6' stroke='%23FFD700' stroke-width='1.5'/%3E%3Cline x1='28' y1='10' x2='26' y2='10' stroke='%23FFD700' stroke-width='1.5'/%3E%3Cline x1='27' y1='5' x2='25' y2='7' stroke='%23FFD700' stroke-width='1.5'/%3E%3C/svg%3E") 4 28, auto`;

function scatterPieces(words: string[]): Piece[] {
  const margin = 60;
  const topMargin = 100;
  const maxW = Math.min(window.innerWidth, 900) - margin * 2;
  const maxH = Math.min(window.innerHeight - 200, 500) - margin;
  return words.map((word, index) => ({
    word, index,
    x: margin + Math.random() * maxW,
    y: topMargin + margin + Math.random() * maxH,
    found: false, hovered: false,
    asset: GARDEN_ASSETS[Math.floor(Math.random() * GARDEN_ASSETS.length)],
    assetRotation: Math.random() * 30 - 15,
  }));
}

const SparkleTrail = ({ sparkles }: { sparkles: Sparkle[] }) => (
  <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
    {sparkles.map(s => {
      const age = (Date.now() - s.born) / SPARKLE_LIFETIME;
      return <div key={s.id} className="absolute rounded-full" style={{ left: s.x - 4, top: s.y - 4, width: 8 * (1 - age), height: 8 * (1 - age), background: s.color, opacity: 1 - age, boxShadow: `0 0 ${6 + 4 * (1 - age)}px ${s.color}` }} />;
    })}
  </div>
);

const CollectionBar = ({ collected, total }: { collected: string[]; total: number }) => (
  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-4 py-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/20 min-w-[200px] max-w-[90vw] flex-wrap">
    {Array.from({ length: total }).map((_, i) => (
      <motion.span key={i} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-bold"
        style={{
          background: collected[i] ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.1)',
          color: collected[i] ? '#1a1a2e' : 'rgba(255,255,255,0.3)',
          border: collected[i] ? '2px solid #FFD700' : '1px dashed rgba(255,255,255,0.2)',
          minWidth: 40,
        }}
        initial={collected[i] ? { scale: 0, y: 60 } : {}}
        animate={collected[i] ? { scale: 1, y: 0 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        {collected[i] || '___'}
      </motion.span>
    ))}
  </div>
);

const TreasureChest = ({ onDone }: { onDone: () => void }) => {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="absolute inset-0 bg-black/50" />
      <motion.div className="relative z-10 flex flex-col items-center" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
        <div className="text-8xl mb-4">🎁</div>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 }} className="text-4xl font-display font-bold text-yellow-300 drop-shadow-lg">✨ Sentence Complete! ✨</motion.div>
      </motion.div>
    </motion.div>
  );
};

const GrammarGardenTreasureGame = () => {
  const navigate = useNavigate();
  const { pairs, loading } = useGrammarPairs(10);
  const { saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [collected, setCollected] = useState<string[]>([]);
  const [nextExpected, setNextExpected] = useState(0);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [showChest, setShowChest] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const sparkleId = useRef(0);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  const currentPair = pairs[currentIdx];
  // Use the answer as the sentence to construct
  const sentenceWords = useMemo(() => currentPair?.answer.split(/\s+/) || [], [currentPair]);

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
      setTimeout(() => { if (bgmRef.current) bgmRef.current.volume = BGM_FULL; }, 1200);
    }
  }, [bgmPlaying]);

  useEffect(() => {
    if (!currentPair || !gameStarted) return;
    const words = currentPair.answer.split(/\s+/);
    setPieces(scatterPieces(words));
    setCollected([]);
    setNextExpected(0);
    setShowChest(false);
  }, [currentIdx, currentPair, gameStarted]);

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
    const colors = ['#FFD700', '#C0C0C0', '#FFA500', '#FFFACD'];
    setSparkles(prev => [...prev.slice(-40), { id: sparkleId.current++, x: e.clientX, y: e.clientY, born: Date.now(), color: colors[Math.floor(Math.random() * colors.length)] }]);
  }, []);

  const handlePieceHover = useCallback((index: number, hovered: boolean) => {
    setPieces(prev => prev.map(p => p.index === index ? { ...p, hovered } : p));
  }, []);

  const handlePieceClick = useCallback((piece: Piece) => {
    if (piece.found) return;
    const expectedWord = sentenceWords[nextExpected];
    if (piece.word.toLowerCase() === expectedWord?.toLowerCase()) {
      duckBgm(); playCorrect();
      setPieces(prev => prev.map(p => p.index === piece.index ? { ...p, found: true } : p));
      setCollected(prev => [...prev, piece.word]);
      const newNext = nextExpected + 1;
      setNextExpected(newNext);
      if (newNext === sentenceWords.length) {
        setScore(s => s + 10);
        setCorrectCount(c => c + 1);
        setShowChest(true);
        duckBgm();
      }
    } else {
      duckBgm(); playWrong();
    }
  }, [nextExpected, sentenceWords, duckBgm, playCorrect, playWrong]);

  const handleChestDone = useCallback(() => {
    setShowChest(false);
    if (currentIdx + 1 < pairs.length) {
      setCurrentIdx(i => i + 1);
    } else {
      const pct = Math.round((correctCount / pairs.length) * 100);
      saveSession('grammar-garden-treasure', score, pairs.length, correctCount);
      playFinish(pct);
      setFinished(true);
    }
  }, [currentIdx, pairs.length, correctCount, score, saveSession, playFinish]);

  if (!gameStarted) {
    return (
      <div className="relative min-h-[80vh] flex flex-col items-center justify-center overflow-hidden rounded-2xl">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" src="/media/gdvideo.mp4" />
        <div className="absolute inset-0 bg-black/40" />
        <motion.div className="relative z-10 flex flex-col items-center gap-6 p-8 rounded-3xl bg-black/30 backdrop-blur-md border border-white/10" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl">🪄</div>
          <h1 className="text-3xl font-display font-bold text-yellow-300 drop-shadow-lg">Grammar Garden</h1>
          <p className="text-white/80 text-center max-w-sm">Find hidden words in the garden and arrange them to build complete sentences!</p>
          <Button onClick={() => { setGameStarted(true); bgmRef.current?.play().catch(() => {}); setBgmPlaying(true); }} className="px-8 py-3 text-lg font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-xl">✨ Start Adventure</Button>
          <Button variant="ghost" onClick={() => navigate('/games')} className="text-white/60 hover:text-white"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </motion.div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Loading garden...</div>;
  if (pairs.length < 1) return <div className="text-center py-20 text-muted-foreground">Need at least 1 grammar pair!</div>;

  if (finished) {
    return <GameResults score={score} total={pairs.length} correct={correctCount} gameType="grammar-garden-treasure" onPlayAgain={() => { setCurrentIdx(0); setScore(0); setCorrectCount(0); setFinished(false); }} />;
  }

  return (
    <div ref={containerRef} className="relative min-h-[80vh] overflow-hidden rounded-2xl select-none" style={{ cursor: WAND_CURSOR }} onMouseMove={handleMouseMove}>
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" src="/media/gdvideo.mp4" />
      <div className="absolute inset-0 bg-black/20" />

      <div className="absolute top-4 left-4 z-40 flex gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/games')} className="bg-black/30 text-white hover:bg-black/50"><ArrowLeft className="w-5 h-5" /></Button>
        <Button variant="ghost" size="icon" onClick={toggleBgm} className="bg-black/30 text-white hover:bg-black/50">
          {bgmPlaying ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      <div className="absolute top-4 right-4 z-40 px-4 py-2 rounded-xl bg-black/40 backdrop-blur text-yellow-300 font-bold">
        ⭐ {score} &nbsp;|&nbsp; {currentIdx + 1}/{pairs.length}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 px-6 py-2 rounded-xl bg-black/40 backdrop-blur text-white/80 text-sm font-medium">
        🔍 Question: <span className="text-yellow-300 font-bold">{currentPair?.question}</span>
      </div>

      <CollectionBar collected={collected} total={sentenceWords.length} />

      <div className="relative z-20 w-full h-full" style={{ minHeight: '70vh' }}>
        <AnimatePresence>
          {pieces.filter(p => !p.found).map(piece => (
            <motion.div key={`${currentIdx}-${piece.index}`} className="absolute" style={{ left: piece.x, top: piece.y, cursor: WAND_CURSOR }}
              initial={{ scale: 0, rotate: Math.random() * 60 - 30 }} animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, y: -80, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              onMouseEnter={() => handlePieceHover(piece.index, true)} onMouseLeave={() => handlePieceHover(piece.index, false)}
              onClick={() => handlePieceClick(piece)}
            >
              <div className="relative" style={{ width: PIECE_SIZE + 20, height: PIECE_SIZE + 10 }}>
                <div className="absolute flex items-center justify-center rounded-lg font-bold text-sm select-none px-2"
                  style={{ minWidth: PIECE_SIZE, height: 40, left: 5, top: 10, background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#1a1a2e', opacity: 1, boxShadow: piece.hovered ? '0 0 20px rgba(255,215,0,0.8)' : '0 2px 8px rgba(0,0,0,0.3)', zIndex: 1, whiteSpace: 'nowrap' }}>
                  {piece.word}
                </div>
                <motion.div className="absolute select-none" style={{ fontSize: piece.hovered ? '2rem' : '3rem', left: piece.hovered ? 15 : 0, top: piece.hovered ? 10 : -10, zIndex: 2, filter: piece.hovered ? 'brightness(1.3)' : 'none', transform: `rotate(${piece.assetRotation}deg)`, transition: 'all 0.3s ease' }} whileTap={{ scale: 0.85 }}>
                  {piece.asset}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <SparkleTrail sparkles={sparkles} />
      <AnimatePresence>{showChest && <TreasureChest onDone={handleChestDone} />}</AnimatePresence>
    </div>
  );
};

export default GrammarGardenTreasureGame;
