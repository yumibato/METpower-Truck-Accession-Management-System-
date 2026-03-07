import React, { createContext, useContext } from 'react';

interface DesignTokens {
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

interface DesignSystemContextType {
  tokens: DesignTokens;
}

const DesignSystemContext = createContext<DesignSystemContextType | undefined>(undefined);

export const useDesignTokens = () => {
  const context = useContext(DesignSystemContext);
  if (!context) {
    throw new Error('useDesignTokens must be used within a DesignSystemProvider');
  }
  return context.tokens;
};

const DESIGN_TOKENS: DesignTokens = {
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    full: '999px',
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07)',
    lg: '0 6px 24px rgba(0, 0, 0, 0.10)',
    xl: '0 20px 40px rgba(0, 0, 0, 0.12)',
  },
};

export const DesignSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DesignSystemContext.Provider value={{ tokens: DESIGN_TOKENS }}>
      {children}
    </DesignSystemContext.Provider>
  );
};
