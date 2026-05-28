"use client";

import { RedirectPageSkeleton } from "@/components/page-skeletons";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WhatsAppCatalogueRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/whatsapp?tab=catalogue");
  }, [router]);

  return <RedirectPageSkeleton />;
}
