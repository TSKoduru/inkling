// web/app/providers.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  accentColor: '#000000',
  setAccentColor: (color: string) => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to black
  const [accentColor, setAccentColor] = useState('#000000');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('inkling-accent');
    if (saved) setAccentColor(saved);
    setMounted(true);
  }, []);

  const updateColor = (color: string) => {
    setAccentColor(color);
    localStorage.setItem('inkling-accent', color);
  };

  if (!mounted) {
    // Return children without custom style to avoid hydration mismatch
    // or return null if you prefer a blank slate until load
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ accentColor, setAccentColor: updateColor }}>
      {/* This injects the variable into the entire app scope */}
      <div 
        style={{ '--accent-color': accentColor } as React.CSSProperties} 
        className="contents"
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}