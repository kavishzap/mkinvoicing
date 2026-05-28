"use client";

import { RedirectPageSkeleton } from "@/components/page-skeletons";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WhatsAppGroupsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/whatsapp?tab=groups");
  }, [router]);

  return <RedirectPageSkeleton />;
}
