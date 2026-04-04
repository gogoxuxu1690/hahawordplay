import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

/**
 * Shows a full-screen overlay prompting the user to rotate to landscape
 * when on a mobile device in portrait mode.
 */
export const LandscapePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowPrompt(isMobile && isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md"
        >
          <motion.div
            animate={{ rotate: [0, -90, -90, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          >
            <RotateCcw className="w-16 h-16 text-primary" />
          </motion.div>
          <p className="mt-6 text-xl font-display font-bold text-foreground text-center px-8">
            Please rotate your device for the best experience 📱
          </p>
          <p className="mt-2 text-sm text-muted-foreground text-center px-8">
            This game works best in landscape mode
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
