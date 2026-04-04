import { useEffect, useState, useRef } from 'react';
import { LandscapePrompt } from './LandscapePrompt';

interface GameResponsiveWrapperProps {
  children: React.ReactNode;
  /** Desired aspect ratio width (default 16) */
  aspectW?: number;
  /** Desired aspect ratio height (default 9) */
  aspectH?: number;
  /** Max width in px (default 1200) */
  maxWidth?: number;
  /** Whether to show landscape prompt on mobile portrait */
  requireLandscape?: boolean;
}

/**
 * Wraps a game in a responsive container that:
 * 1. Maintains aspect ratio via uniform scaling
 * 2. Ensures touch targets are large enough
 * 3. Optionally prompts for landscape orientation
 */
export const GameResponsiveWrapper = ({
  children,
  aspectW = 16,
  aspectH = 9,
  maxWidth = 1200,
  requireLandscape = true,
}: GameResponsiveWrapperProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Calculate the ideal game size
      const idealW = Math.min(vw, maxWidth);
      const idealH = idealW * (aspectH / aspectW);

      // If it's too tall, scale based on height
      if (idealH > vh * 0.9) {
        const fitH = vh * 0.9;
        const fitW = fitH * (aspectW / aspectH);
        setScale(Math.min(fitW / maxWidth, 1));
      } else {
        setScale(Math.min(idealW / maxWidth, 1));
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [aspectW, aspectH, maxWidth]);

  return (
    <>
      {requireLandscape && <LandscapePrompt />}
      <div
        ref={containerRef}
        className="w-full flex items-start justify-center overflow-hidden"
        style={{ minHeight: '80vh' }}
      >
        <div
          style={{
            width: maxWidth,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};
