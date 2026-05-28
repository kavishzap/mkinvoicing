"use client";

import { RedirectPageSkeleton } from "@/components/page-skeletons";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReportsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/reportings?tab=pnl");
  }, [router]);

  return <RedirectPageSkeleton />;
}
