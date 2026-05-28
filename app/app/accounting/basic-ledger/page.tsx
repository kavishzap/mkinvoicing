"use client";

import { RedirectPageSkeleton } from "@/components/page-skeletons";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BasicLedgerRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/accounting?tab=basic");
  }, [router]);

  return <RedirectPageSkeleton />;
}
