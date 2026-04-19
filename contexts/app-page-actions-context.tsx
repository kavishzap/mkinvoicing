"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type AppPageActionsContextValue = {
  actions: React.ReactNode | null;
  setActions: (node: React.ReactNode | null) => void;
};

const AppPageActionsContext =
  createContext<AppPageActionsContextValue | null>(null);

export function AppPageActionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [actions, setActionsState] = useState<React.ReactNode | null>(null);
  const setActions = useCallback((node: React.ReactNode | null) => {
    setActionsState(node);
  }, []);

  const value = useMemo(
    () => ({ actions, setActions }),
    [actions, setActions],
  );

  return (
    <AppPageActionsContext.Provider value={value}>
      {children}
    </AppPageActionsContext.Provider>
  );
}

export function useAppPageActions() {
  const ctx = useContext(AppPageActionsContext);
  if (!ctx) {
    throw new Error(
      "useAppPageActions must be used within AppPageActionsProvider",
    );
  }
  return ctx;
}
