import React, { createContext, useContext, useState, useCallback } from "react";

interface SidebarVisibilityContextType {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const SidebarVisibilityContext = createContext<SidebarVisibilityContextType | undefined>(undefined);

export function SidebarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const setHidden = useCallback((value: boolean) => setHiddenState(value), []);

  return (
    <SidebarVisibilityContext.Provider value={{ hidden, setHidden }}>
      {children}
    </SidebarVisibilityContext.Provider>
  );
}

// Permite que uma página (ex.: editor de fluxo de automação) esconda a nav
// lateral enquanto estiver montada, devolvendo mais espaço horizontal.
export function useSidebarVisibility() {
  const ctx = useContext(SidebarVisibilityContext);
  if (!ctx) throw new Error("useSidebarVisibility must be used within a SidebarVisibilityProvider");
  return ctx;
}
