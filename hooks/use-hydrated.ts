"use client";

import { useEffect, useState } from "react";

/** True after the first client commit — safe to mount Radix primitives that generate IDs. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
