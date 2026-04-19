"use client";

import { useLayoutEffect } from "react";
import { useAppPageActions } from "@/contexts/app-page-actions-context";

/** Registers `AppPageShell` actions into the app top bar (next to the page title). */
export function RegisterPageActions({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setActions } = useAppPageActions();
  useLayoutEffect(() => {
    setActions(children);
    return () => setActions(null);
  }, [children, setActions]);
  return null;
}
