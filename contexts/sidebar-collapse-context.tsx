"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SIDEBAR_COLLAPSED_KEY = "mkinv:sidebar-collapsed";

type SidebarCollapseContextValue = {
  collapsed: boolean;
  setCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleCollapsed: () => void;
};

const SidebarCollapseContext =
  createContext<SidebarCollapseContextValue | null>(null);

export function SidebarCollapseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      setCollapsedState(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const setCollapsed = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setCollapsedState(value);
    },
    []
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((c) => !c);
  }, []);

  const value = useMemo(
    () => ({ collapsed, setCollapsed, toggleCollapsed }),
    [collapsed, setCollapsed, toggleCollapsed]
  );

  return (
    <SidebarCollapseContext.Provider value={value}>
      {children}
    </SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse(): SidebarCollapseContextValue {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) {
    throw new Error(
      "useSidebarCollapse must be used within <SidebarCollapseProvider>"
    );
  }
  return ctx;
}
