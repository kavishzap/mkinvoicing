"use client";

import { RedirectPageSkeleton } from "@/components/page-skeletons";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExpenseReportRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/reportings?tab=expense");
  }, [router]);

  return <RedirectPageSkeleton />;
}
