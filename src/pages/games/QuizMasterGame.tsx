import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGrammarPairs } from '@/hooks/useGrammarPairs';
import { useGameSounds } from '@/hooks/useGameSounds';
import { useRecordResult } from '@/hooks/useGameWords';
import { GameResults } from '@/components/GameResults';

interface Round {
  questionText: string;
  correctAnswer: string;
  options: string[];
  gender: string;
}

const QuizMasterGame = () => {
  const navigate = useNavigate();
  const { pairs, loading } = useGrammarPairs(10);
  const { playCorrect, playWrong } = useGameSounds();
  const { saveSession } = useRecordResult();

  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundIdx, setRoundIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (pairs.length < 2) return;
    const allAnswers = pairs.map(p => p.answer);
    const r: Round[] = pairs.map(p => {
      const distractors = allAnswers.filter(a => a !== p.answer).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [...distractors, p.answer].sort(() => Math.random() - 0.5);
      return { questionText: p.question, correctAnswer: p.answer, options, gender: p.voice_gender };
    });
    setRounds(r);
  }, [pairs]);

  const speak = useCallback((text: string, gender: string) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      gender === 'male' ? v.name.toLowerCase().includes('male') || v.name.includes('David')
        : v.name.toLowerCase().includes('female') || v.name.includes('Samantha') || v.name.includes('Zira')
    );
    if (preferred) u.voice = preferred;
    speechSynthesis.speak(u);
  }, []);

  useEffect(() => {
    if (rounds.length > 0 && roundIdx < rounds.length && !finished) {
      const t = setTimeout(() => speak(rounds[roundIdx].questionText, rounds[roundIdx].gender), 500);
      return () => clearTimeout(t);
    }
  }, [roundIdx, rounds, finished, speak]);

  const pick = (option: string) => {
    if (selected) return;
    setSelected(option);
    const isCorrect = option === rounds[roundIdx].correctAnswer;
    if (isCorrect) {
      playCorrect();
      setScore(s => s + 10);
      setCorrect(c => c + 1);
    } else {
      playWrong();
    }
    setTimeout(() => {
      if (roundIdx + 1 >= rounds.length) {
        setFinished(true);
      } else {
        setRoundIdx(i => i + 1);
        setSelected(null);
      }
    }, 1200);
  };

  const handleFinish = useCallback(async () => {
    await saveSession('quiz-master', score, rounds.length, correct);
  }, [saveSession, score, rounds.length, correct]);

  useEffect(() => { if (finished) handleFinish(); }, [finished, handleFinish]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (pairs.length < 2) return <div className="text-center py-20"><p className="text-muted-foreground">Need at least 2 pairs.</p><Button onClick={() => navigate('/games')} className="mt-4 rounded-xl">Back</Button></div>;

  if (finished) return <GameResults score={score} total={rounds.length} correct={correct} gameType="quiz-master" onPlayAgain={() => window.location.reload()} />;

  const current = rounds[roundIdx];
  if (!current) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => navigate('/games')}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-2xl font-display font-bold text-foreground">Quiz Master 🧠</h1>
        <span className="ml-auto text-sm font-bold text-primary">{score} pts</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Round {roundIdx + 1} / {rounds.length}</p>

      <motion.div key={roundIdx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-8 game-card-shadow space-y-6">
        <div className="text-center">
          <Button variant="outline" size="lg" className="rounded-xl gap-2 mx-auto mb-4" onClick={() => speak(current.questionText, current.gender)}>
            <Volume2 className="w-5 h-5" /> Listen Again
          </Button>
          <p className="font-display font-bold text-lg text-foreground">{current.questionText}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {current.options.map((option, i) => {
            const isCorrectOption = option === current.correctAnswer;
            const isSelected = selected === option;
            let bg = 'bg-muted hover:bg-muted/80';
            if (selected) {
              if (isCorrectOption) bg = 'bg-primary/20 border-primary';
              else if (isSelected) bg = 'bg-destructive/20 border-destructive';
            }
            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.97 }}
                onClick={() => pick(option)}
                disabled={!!selected}
                className={`p-4 rounded-xl border-2 text-left font-semibold text-foreground transition-all ${bg}`}
              >
                {option}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default QuizMasterGame;
