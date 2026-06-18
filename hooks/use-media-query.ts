"use client";

import { useEffect, useState } from "react";

/** Subscribe to a CSS media query; `undefined` until mounted (SSR-safe). */
export function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export const LG_UP_QUERY = "(min-width: 1024px)";

export function useIsLgUp(): boolean | undefined {
  return useMediaQuery(LG_UP_QUERY);
}
