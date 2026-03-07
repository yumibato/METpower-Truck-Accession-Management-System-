import { useEffect, useState } from 'react';

interface DesignColors {
  light: {
    bg: {
      page: string;
      card: string;
      elevated: string;
      input: string;
    };
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
    border: string;
    accent: string;
    state: {
      blue: string;
      green: string;
      red: string;
      pink: string;
      amber: string;
    };
  };
  dark: {
    bg: {
      page: string;
      card: string;
      elevated: string;
      input: string;
    };
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
    border: string;
    accent: string;
    state: {
      blue: string;
      green: string;
      red: string;
      pink: string;
      amber: string;
    };
  };
}

const DESIGN_COLORS: DesignColors = {
  light: {
    bg: {
      page: '#EBEBEB',
      card: '#FFFFFF',
      elevated: '#F9F9F9',
      input: '#F5F5F5',
    },
    text: {
      primary: '#111111',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    },
    border: '#E5E7EB',
    accent: '#1A1A1A',
    state: {
      blue: '#2563EB',
      green: '#22C55E',
      red: '#EF4444',
      pink: '#EC4899',
      amber: '#F97316',
    },
  },
  dark: {
    bg: {
      page: '#111111',
      card: '#1A1A1A',
      elevated: '#222222',
      input: '#2A2A2A',
    },
    text: {
      primary: '#F5F5F5',
      secondary: '#A1A1AA',
      muted: '#52525B',
    },
    border: '#2E2E2E',
    accent: '#FFFFFF',
    state: {
      blue: '#3B82F6',
      green: '#4ADE80',
      red: '#F87171',
      pink: '#F472B6',
      amber: '#FB923C',
    },
  },
};

export const useDesignColors = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const initialDark = root.classList.contains('dark');
    setIsDark(initialDark);

    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });

    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark ? DESIGN_COLORS.dark : DESIGN_COLORS.light;
};

export const getDesignColor = (path: string, isDark = false) => {
  const colors = isDark ? DESIGN_COLORS.dark : DESIGN_COLORS.light;
  return path.split('.').reduce((obj: any, key) => obj?.[key], colors);
};

export default DESIGN_COLORS;
