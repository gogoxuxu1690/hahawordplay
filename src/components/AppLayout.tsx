import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Gamepad2, GraduationCap, LogOut, BarChart3, Volume2, VolumeX, BookType } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { getGlobalMuted, setGlobalMuted, subscribeGlobalMuted } from '@/hooks/useGameSounds';

const navItems = [
  { to: '/', label: 'Words', icon: BookOpen },
  { to: '/grammar', label: 'Grammar', icon: BookType },
  { to: '/games', label: 'Play', icon: Gamepad2 },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const [muted, setMuted] = useState(getGlobalMuted());

  useEffect(() => subscribeGlobalMuted(setMuted), []);

  const toggleMute = () => setGlobalMuted(!muted);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">WordPlay</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={active ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-xl gap-2 font-semibold"
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="container py-8"
      >
        {children}
      </motion.main>
    </div>
  );
}
