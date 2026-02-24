import { motion } from 'framer-motion';
import { Trophy, Star, RotateCcw, Home } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface GameResultsProps {
  score: number;
  total: number;
  correct: number;
  gameType: string;
  onPlayAgain: () => void;
}

export function GameResults({ score, total, correct, gameType, onPlayAgain }: GameResultsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mastery = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className="max-w-md mx-auto text-center py-12"
    >
      <motion.div
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-7xl mb-6"
      >
        {mastery >= 80 ? '🏆' : mastery >= 50 ? '⭐' : '💪'}
      </motion.div>

      <h1 className="text-3xl font-display font-bold text-foreground mb-2">
        {mastery >= 80 ? 'Amazing!' : mastery >= 50 ? 'Good Job!' : 'Keep Practicing!'}
      </h1>

      <div className="bg-card rounded-2xl p-6 game-card-shadow mt-6 space-y-4">
        <div className="flex justify-around">
          <div>
            <p className="text-3xl font-display font-bold text-primary">{score}</p>
            <p className="text-sm text-muted-foreground">Score</p>
          </div>
          <div>
            <p className="text-3xl font-display font-bold text-secondary">{correct}/{total}</p>
            <p className="text-sm text-muted-foreground">Correct</p>
          </div>
          <div>
            <p className="text-3xl font-display font-bold text-accent">{mastery}%</p>
            <p className="text-sm text-muted-foreground">Mastery</p>
          </div>
        </div>

        {/* Mastery bar */}
        <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${mastery}%` }}
            transition={{ duration: 1, delay: 0.5 }}
            className="h-full rounded-full bg-primary"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-8 justify-center">
        <Button variant="outline" className="rounded-xl gap-2" onClick={() => navigate('/games')}>
          <Home className="w-4 h-4" /> Game Center
        </Button>
        <Button className="rounded-xl gap-2" onClick={onPlayAgain}>
          <RotateCcw className="w-4 h-4" /> Play Again
        </Button>
      </div>
    </motion.div>
  );
}
