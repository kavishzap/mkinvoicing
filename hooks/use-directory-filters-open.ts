"use client";

import { useEffect, useState } from "react";
import { useIsLgUp } from "@/hooks/use-media-query";

/** Filter panels start closed on mobile/tablet and open on desktop (lg+). */
export function useDirectoryFiltersOpen() {
  const isLgUp = useIsLgUp();
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (isLgUp === undefined) return;
    setFiltersOpen(isLgUp);
  }, [isLgUp]);

  return [filtersOpen, setFiltersOpen] as const;
}
