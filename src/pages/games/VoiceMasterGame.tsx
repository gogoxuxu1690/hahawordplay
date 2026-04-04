import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Mic, MicOff, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameWords, useRecordResult } from '@/hooks/useGameWords';
import { useGameSounds } from '@/hooks/useGameSounds';
import { GameResults } from '@/components/GameResults';
import { GameResponsiveWrapper } from '@/components/GameResponsiveWrapper';
import { advancedSimilarity, useSpeechRecognition } from '@/hooks/useSpeechRecognition';

const CORRECT_THRESHOLD = 75;

const VoiceMasterGame = () => {
  const { words, loading } = useGameWords(10);
  const { recordResult, saveSession } = useRecordResult();
  const { playCorrect, playWrong, playFinish } = useGameSounds();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'recording' | 'result' | 'finished'>('listen');
  const [spokenText, setSpokenText] = useState('');
  const [accuracy, setAccuracy] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const currentWord = words[currentIndex];

  const { isSupported: micSupported, startListening, stopListening } = useSpeechRecognition({
    onStart: () => {
      setIsListening(true);
      setPhase('recording');
    },
    onResult: (result) => {
      setSpokenText(result.text);
      setAccuracy(result.accuracy);
      setTotalScore(prev => prev + result.accuracy);
      if (result.accuracy >= CORRECT_THRESHOLD) {
        setCorrectCount(prev => prev + 1);
        playCorrect();
        recordResult(currentWord!.id, true);
      } else {
        playWrong();
        recordResult(currentWord!.id, false);
      }
      setPhase('result');
      setIsListening(false);
    },
    onError: () => {
      setIsListening(false);
      setPhase('result');
      setSpokenText('(not recognized)');
      setAccuracy(0);
    },
    onEnd: () => setIsListening(false),
  });

  const speakWord = useCallback((word: string, gender?: string) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.85;
    u.pitch = gender === 'female' ? 1.2 : 0.9;
    speechSynthesis.speak(u);
  }, []);

  useEffect(() => {
    if (currentWord && phase === 'listen') {
      const t = setTimeout(() => speakWord(currentWord.word, currentWord.voice_gender), 400);
      return () => clearTimeout(t);
    }
  }, [currentIndex, currentWord, phase, speakWord]);

  const handleStartRecording = useCallback(() => {
    if (currentWord) startListening(currentWord.word);
  }, [currentWord, startListening]);

  const nextWord = useCallback(() => {
    if (currentIndex + 1 >= words.length) {
      const total = words.length;
      const avgScore = Math.round(totalScore / total);
      saveSession('voice-master', totalScore, total, correctCount);
      playFinish(Math.round((correctCount / total) * 100));
      setPhase('finished');
    } else {
      setCurrentIndex(prev => prev + 1);
      setSpokenText('');
      setAccuracy(0);
      setPhase('listen');
    }
  }, [currentIndex, words.length, totalScore, correctCount, saveSession, playFinish]);

  const handlePlayAgain = () => {
    setCurrentIndex(0);
    setTotalScore(0);
    setCorrectCount(0);
    setSpokenText('');
    setAccuracy(0);
    setPhase('listen');
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (words.length < 2) return <div className="text-center py-20 text-muted-foreground">Need at least 2 words. Add more words first!</div>;

  if (phase === 'finished') {
    return <GameResults score={totalScore} total={words.length} correct={correctCount} gameType="voice-master" onPlayAgain={handlePlayAgain} />;
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

  const accuracyColor = accuracy >= CORRECT_THRESHOLD ? 'text-green-500' : accuracy >= 50 ? 'text-yellow-500' : 'text-red-500';
  const accuracyMessage = accuracy >= CORRECT_THRESHOLD ? 'Great Job! 🎉' : accuracy >= 50 ? 'Not Bad! 👍' : 'Try Again! 💪';

  return (
    <GameResponsiveWrapper requireLandscape={false}>
      <div className="max-w-lg mx-auto text-center px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground">Voice Master 🎤</h1>
          <span className="text-sm font-semibold text-muted-foreground bg-card px-3 py-1 rounded-full">
            {currentIndex + 1} / {words.length}
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-muted mb-8 overflow-hidden">
          <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${((currentIndex) / words.length) * 100}%` }} transition={{ duration: 0.3 }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="mb-6">
            {currentWord?.image_url ? (
              <div className="w-48 h-48 mx-auto rounded-2xl overflow-hidden bg-muted game-card-shadow">
                <img src={currentWord.image_url} alt="Word hint" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-48 h-48 mx-auto rounded-2xl bg-card game-card-shadow flex items-center justify-center">
                <span className="text-6xl">🖼️</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <Button variant="outline" className="rounded-xl gap-2 mb-6" onClick={() => speakWord(currentWord!.word, currentWord!.voice_gender)}>
          <Volume2 className="w-5 h-5" /> Listen Again
        </Button>

        {(phase === 'listen' || phase === 'recording') && (
          <div className="mb-8">
            <motion.button
              onClick={isListening ? stopListening : handleStartRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto transition-colors game-card-shadow ${isListening ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}
              animate={isListening ? { scale: [1, 1.1, 1] } : {}}
              transition={isListening ? { repeat: Infinity, duration: 1 } : {}}
            >
              {isListening ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
            </motion.button>
            <p className="text-sm text-muted-foreground mt-3">{isListening ? 'Listening... Tap to stop' : 'Tap to speak'}</p>
          </div>
        )}

        {phase === 'result' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-6 game-card-shadow mb-6">
            <p className="text-sm text-muted-foreground mb-1">You said:</p>
            <p className="text-xl font-bold text-foreground mb-3">"{spokenText}"</p>
            <p className="text-sm text-muted-foreground mb-1">Target word:</p>
            <p className="text-xl font-bold text-primary mb-4">"{currentWord?.word}"</p>
            <div className={`text-4xl font-display font-bold ${accuracyColor} mb-1`}>{accuracy}%</div>
            <p className={`text-lg font-semibold ${accuracyColor}`}>{accuracyMessage}</p>
            <div className="w-full h-3 rounded-full bg-muted mt-4 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${accuracy}%` }} transition={{ duration: 0.8 }}
                className={`h-full rounded-full ${accuracy >= CORRECT_THRESHOLD ? 'bg-green-500' : accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
            </div>
            <div className="flex gap-3 mt-6 justify-center">
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => { setSpokenText(''); setAccuracy(0); setPhase('listen'); }}>
                <Mic className="w-4 h-4" /> Try Again
              </Button>
              <Button className="rounded-xl gap-2" onClick={nextWord}>
                <SkipForward className="w-4 h-4" /> Next
              </Button>
            </div>
          </motion.div>
        )}

        <div className="text-sm text-muted-foreground">Score: <span className="font-bold text-foreground">{totalScore}</span> pts</div>
      </div>
    </GameResponsiveWrapper>
  );
};

export default VoiceMasterGame;
