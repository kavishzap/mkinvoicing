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
  /** Renders before the top bar page title (e.g. back affordance). */
  titleBefore: React.ReactNode | null;
  setTitleBefore: (node: React.ReactNode | null) => void;
  /** Renders in the top bar after company name and before the theme toggle. */
  trailingBeforeTheme: React.ReactNode | null;
  setTrailingBeforeTheme: (node: React.ReactNode | null) => void;
};

const AppPageActionsContext =
  createContext<AppPageActionsContextValue | null>(null);

export function AppPageActionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [actions, setActionsState] = useState<React.ReactNode | null>(null);
  const [titleBefore, setTitleBeforeState] =
    useState<React.ReactNode | null>(null);
  const [trailingBeforeTheme, setTrailingBeforeThemeState] =
    useState<React.ReactNode | null>(null);
  const setActions = useCallback((node: React.ReactNode | null) => {
    setActionsState(node);
  }, []);
  const setTitleBefore = useCallback((node: React.ReactNode | null) => {
    setTitleBeforeState(node);
  }, []);
  const setTrailingBeforeTheme = useCallback((node: React.ReactNode | null) => {
    setTrailingBeforeThemeState(node);
  }, []);

  const value = useMemo(
    () => ({
      actions,
      setActions,
      titleBefore,
      setTitleBefore,
      trailingBeforeTheme,
      setTrailingBeforeTheme,
    }),
    [
      actions,
      setActions,
      titleBefore,
      setTitleBefore,
      trailingBeforeTheme,
      setTrailingBeforeTheme,
    ],
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
