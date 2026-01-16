'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Menu, Sun, Moon, Mail } from 'lucide-react';
import { useThemeStore } from '@/lib/store';

interface HeaderProps {
  showBackButton?: boolean;
  onMenuClick?: () => void;
}

export function Header({ showBackButton = false, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const isDark = useThemeStore((state) => state.isDark);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm border-b border-stone-200 dark:border-stone-800">
      <div className="container mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-stone-600 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-stone-600 dark:text-stone-400 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-stone-800 dark:text-stone-100 hidden sm:block">
              PST Vault
            </span>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-stone-600 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}
