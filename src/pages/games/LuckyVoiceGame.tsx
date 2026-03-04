import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Mic, MicOff, Play, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';

/* ── helpers ─────────────────────────────────────────────── */

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function similarity(spoken: string, target: string): number {
  const a = spoken.toLowerCase().trim();
  const b = target.toLowerCase().trim();
  if (a === b) return 100;
  if (!a) return 0;
  const dist = levenshtein(a, b);
  return Math.max(0, Math.round((1 - dist / Math.max(a.length, b.length)) * 100));
}

/* ── ting sound ───────────────────────────────────────────── */

function playTing(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1800 + Math.random() * 400, ctx.currentTime);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

/* ── constants ────────────────────────────────────────────── */
const TOTAL_STEPS = 30; // how many boxes the light visits
const MIN_INTERVAL = 60; // ms fastest
const MAX_INTERVAL = 400; // ms slowest at end

/* ── component ────────────────────────────────────────────── */

const LuckyVoiceGame = () => {
  const { words, loading } = useGameWords(10);
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();

  const [phase, setPhase] = useState<'idle' | 'spinning' | 'speaking' | 'finished'>('idle');
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [exploded, setExploded] = useState<Set<number>>(new Set());
  const [particles, setParticles] = useState<{ idx: number; id: number }[]>([]);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [spokenText, setSpokenText] = useState('');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [micSupported, setMicSupported] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const particleId = useRef(0);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setMicSupported(false);
  }, []);

  /* ── spin logic ──────────────────────────────────────────── */

  const spin = useCallback(() => {
    if (words.length === 0) return;
    setPhase('spinning');
    setSpokenText('');
    setAccuracy(null);

    // pick a random non-exploded target
    const available = words.map((_, i) => i).filter(i => !exploded.has(i));
    if (available.length === 0) return;
    const targetIdx = available[Math.floor(Math.random() * available.length)];

    // build schedule: TOTAL_STEPS jumps, landing on targetIdx
    const ctx = getCtx();
    let step = 0;
    let current = highlightIdx ?? 0;

    const schedule = () => {
      if (step >= TOTAL_STEPS) {
        // land on target
        setHighlightIdx(targetIdx);
        playTing(ctx);
        // short pause, then enter speaking phase
        setTimeout(() => {
          setPhase('speaking');
          // auto-play TTS
          speakWord(words[targetIdx].word, words[targetIdx].voice_gender);
        }, 600);
        return;
      }

      // deceleration: interval grows as step increases
      const progress = step / TOTAL_STEPS;
      const interval = MIN_INTERVAL + (MAX_INTERVAL - MIN_INTERVAL) * Math.pow(progress, 2.5);

      // jump to next non-exploded box
      const allIndices = words.map((_, i) => i).filter(i => !exploded.has(i));
      // if near end, bias towards target
      if (step >= TOTAL_STEPS - 3) {
        current = targetIdx;
      } else {
        // next random from available, different from current
        const choices = allIndices.filter(i => i !== current);
        current = choices.length > 0 ? choices[Math.floor(Math.random() * choices.length)] : current;
      }

      setHighlightIdx(current);
      playTing(ctx);
      step++;
      setTimeout(schedule, interval);
    };

    schedule();
  }, [words, exploded, highlightIdx, getCtx]);

  /* ── TTS ─────────────────────────────────────────────────── */

  const speakWord = useCallback((word: string, gender?: string) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.85;
    u.pitch = gender === 'female' ? 1.2 : 0.9;
    speechSynthesis.speak(u);
  }, []);

  /* ── Speech recognition ──────────────────────────────────── */

  const startRecording = useCallback(() => {
    if (highlightIdx === null) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    const targetWord = words[highlightIdx];

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let bestAcc = 0;
      let bestText = '';
      for (let i = 0; i < event.results[0].length; i++) {
        const transcript = event.results[0][i].transcript;
        const acc = similarity(transcript, targetWord.word);
        if (acc > bestAcc) { bestAcc = acc; bestText = transcript; }
      }
      setSpokenText(bestText);
      setAccuracy(bestAcc);
      setIsListening(false);

      if (bestAcc > 80) {
        // success → explode
        playCorrect();
        recordResult(targetWord.id, true);
        setScore(prev => prev + 10);
        setExploded(prev => {
          const next = new Set(prev);
          next.add(highlightIdx);
          return next;
        });
        // particle effect
        const pid = particleId.current++;
        setParticles(prev => [...prev, { idx: highlightIdx, id: pid }]);
        setTimeout(() => setParticles(prev => prev.filter(p => p.id !== pid)), 800);

        // check win
        setTimeout(() => {
          setExploded(prev => {
            if (prev.size >= words.length) {
              saveSession('lucky-voice', (prev.size) * 10, words.length, prev.size);
              playFinish(100);
              setPhase('finished');
            } else {
              setPhase('idle');
              setHighlightIdx(null);
            }
            return prev;
          });
        }, 800);
      } else {
        // wrong → shake
        playWrong();
        recordResult(targetWord.id, false);
        setShakeIdx(highlightIdx);
        setTimeout(() => setShakeIdx(null), 500);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setSpokenText('(not recognized)');
      setAccuracy(0);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [highlightIdx, words, playCorrect, playWrong, playFinish, recordResult, saveSession]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  /* ── play again ──────────────────────────────────────────── */

  const handlePlayAgain = () => {
    setPhase('idle');
    setHighlightIdx(null);
    setExploded(new Set());
    setScore(0);
    setSpokenText('');
    setAccuracy(null);
    setParticles([]);
  };

  /* ── render ──────────────────────────────────────────────── */

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (words.length < 2) return <div className="text-center py-20 text-muted-foreground">Need at least 2 words. Add more words first!</div>;

  if (phase === 'finished') {
    return <GameResults score={score} total={words.length} correct={exploded.size} gameType="lucky-voice" onPlayAgain={handlePlayAgain} />;
  }

  if (!micSupported) {
    return (
      <div className="text-center py-20">
        <MicOff className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Microphone Not Supported</h2>
        <p className="text-muted-foreground">Your browser doesn't support Speech Recognition. Try Chrome or Edge.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto text-center">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display font-bold text-foreground">Lucky Voice 🎰🎤</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-muted-foreground bg-card px-3 py-1 rounded-full">
            <Trophy className="w-4 h-4 inline mr-1" />{score} pts
          </span>
          <span className="text-sm font-semibold text-muted-foreground bg-card px-3 py-1 rounded-full">
            {exploded.size}/{words.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-muted mb-6 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${(exploded.size / words.length) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Word Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {words.map((w, i) => {
          const isExploded = exploded.has(i);
          const isHighlighted = highlightIdx === i && !isExploded;
          const isShaking = shakeIdx === i;
          const hasParticle = particles.some(p => p.idx === i);

          return (
            <div key={w.id} className="relative">
              <motion.div
                animate={
                  isShaking
                    ? { x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: 0.5 } }
                    : isExploded
                    ? { scale: 0, opacity: 0, transition: { duration: 0.4 } }
                    : {}
                }
                className={`
                  relative rounded-xl px-3 py-5 font-bold text-base transition-all select-none
                  ${isExploded
                    ? 'bg-transparent border-2 border-dashed border-muted-foreground/20'
                    : isHighlighted
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/40 scale-110 game-card-shadow'
                    : 'bg-card text-foreground border border-border game-card-shadow'
                  }
                `}
              >
                {isExploded ? (
                  <span className="text-muted-foreground/40">✓</span>
                ) : (
                  w.word
                )}

                {/* glow pulse on highlight */}
                {isHighlighted && !isExploded && (
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-primary/20"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                  />
                )}
              </motion.div>

              {/* explosion particles */}
              {hasParticle && (
                <div className="absolute inset-0 pointer-events-none">
                  {Array.from({ length: 8 }).map((_, pi) => (
                    <motion.div
                      key={pi}
                      className="absolute w-2 h-2 rounded-full bg-primary"
                      style={{ left: '50%', top: '50%' }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{
                        x: (Math.cos((pi / 8) * Math.PI * 2)) * 50,
                        y: (Math.sin((pi / 8) * Math.PI * 2)) * 50,
                        opacity: 0,
                        scale: 0,
                      }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      {phase === 'idle' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button
            size="lg"
            className="rounded-xl gap-2 text-lg px-8"
            onClick={spin}
          >
            <Play className="w-5 h-5" /> Spin!
          </Button>
        </motion.div>
      )}

      {phase === 'spinning' && (
        <p className="text-muted-foreground animate-pulse text-lg">Spinning...</p>
      )}

      {phase === 'speaking' && highlightIdx !== null && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-6 game-card-shadow space-y-4"
        >
          <p className="text-sm text-muted-foreground">Say this word:</p>

          {/* Listen Again */}
          <Button
            variant="outline"
            className="rounded-xl gap-2"
            onClick={() => speakWord(words[highlightIdx].word, words[highlightIdx].voice_gender)}
          >
            <Volume2 className="w-5 h-5" /> Listen Again
          </Button>

          {/* Mic button */}
          <div>
            <motion.button
              onClick={isListening ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-colors game-card-shadow ${
                isListening ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
              }`}
              animate={isListening ? { scale: [1, 1.1, 1] } : {}}
              transition={isListening ? { repeat: Infinity, duration: 1 } : {}}
            >
              {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </motion.button>
            <p className="text-sm text-muted-foreground mt-2">
              {isListening ? 'Listening...' : 'Tap to speak'}
            </p>
          </div>

          {/* Result feedback */}
          {accuracy !== null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="text-sm text-muted-foreground">You said: <span className="font-bold text-foreground">"{spokenText}"</span></p>
              <p className={`text-2xl font-display font-bold mt-1 ${accuracy > 80 ? 'text-green-500' : 'text-red-500'}`}>
                {accuracy}% {accuracy > 80 ? '🎉' : '💪 Try Again!'}
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default LuckyVoiceGame;
