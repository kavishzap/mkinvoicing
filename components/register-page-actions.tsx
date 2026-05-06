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

/** Registers content immediately before the top bar page title (e.g. back button). */
export function RegisterPageTitleBefore({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setTitleBefore } = useAppPageActions();
  useLayoutEffect(() => {
    setTitleBefore(children);
    return () => setTitleBefore(null);
  }, [children, setTitleBefore]);
  return null;
}

/** Registers content after the company name and before the theme toggle in the top bar. */
export function RegisterTopbarTrailingBeforeTheme({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setTrailingBeforeTheme } = useAppPageActions();
  useLayoutEffect(() => {
    setTrailingBeforeTheme(children);
    return () => setTrailingBeforeTheme(null);
  }, [children, setTrailingBeforeTheme]);
  return null;
}
