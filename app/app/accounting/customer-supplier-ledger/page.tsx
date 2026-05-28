"use client";

import { RedirectPageSkeleton } from "@/components/page-skeletons";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CustomerSupplierLedgerRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/accounting?tab=contacts");
  }, [router]);

  return <RedirectPageSkeleton />;
}
