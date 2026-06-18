"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ActionProgressDialog } from "@/components/action-progress-dialog";
import { registerActionProgressRunner } from "@/lib/action-progress-bridge";

type ActionProgressContextValue = {
  isRunning: boolean;
  message: string | null;
  runAction: <T>(message: string, fn: () => Promise<T>) => Promise<T>;
};

const ActionProgressContext = createContext<ActionProgressContextValue | null>(
  null,
);

export function ActionProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  const runAction = useCallback(
    async <T,>(message: string, fn: () => Promise<T>): Promise<T> => {
      setState({ open: true, message });
      try {
        return await fn();
      } finally {
        setState({ open: false, message: "" });
      }
    },
    [],
  );

  useEffect(() => {
    registerActionProgressRunner(runAction);
    return () => registerActionProgressRunner(null);
  }, [runAction]);

  const value = useMemo<ActionProgressContextValue>(
    () => ({
      isRunning: state.open,
      message: state.open ? state.message : null,
      runAction,
    }),
    [state.open, state.message, runAction],
  );

  return (
    <ActionProgressContext.Provider value={value}>
      {children}
      <ActionProgressDialog open={state.open} message={state.message} />
    </ActionProgressContext.Provider>
  );
}

export function useActionProgress(): ActionProgressContextValue {
  const ctx = useContext(ActionProgressContext);
  if (!ctx) {
    throw new Error(
      "useActionProgress must be used within <ActionProgressProvider>",
    );
  }
  return ctx;
}
