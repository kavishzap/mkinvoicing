"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, FileDown, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPageShell } from "@/components/app-page-shell";
import { BasicLedgerTab } from "@/components/basic-ledger-tab";
import { CustomerSupplierLedgerTab } from "@/components/customer-supplier-ledger-tab";
import type { ReportTabExportApi } from "@/components/report-tab-export";

type AccountingTab = "basic" | "contacts";

function parseTab(raw: string | null): AccountingTab {
  if (raw === "contacts" || raw === "customer-supplier") return "contacts";
  return "basic";
}

export default function AccountingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState<AccountingTab>(() =>
    parseTab(searchParams.get("tab")),
  );
  const [basicExport, setBasicExport] = useState<ReportTabExportApi | null>(null);
  const [contactsExport, setContactsExport] = useState<ReportTabExportApi | null>(
    null,
  );

  useEffect(() => {
    setMainTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  const activeExport = useMemo(() => {
    if (mainTab === "contacts") return contactsExport;
    return basicExport;
  }, [mainTab, basicExport, contactsExport]);

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      actions={
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => void activeExport?.exportPdf()}
          disabled={!activeExport?.canExport || activeExport.exporting}
        >
          {activeExport?.exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting…
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Export PDF
            </>
          )}
        </Button>
      }
    >
      <Tabs
        value={mainTab}
        onValueChange={(v) => {
          const tab = parseTab(v);
          setMainTab(tab);
          router.replace(`/app/accounting?tab=${tab}`, { scroll: false });
        }}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1 p-1 sm:inline-flex sm:w-auto">
          <TabsTrigger value="basic" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Basic ledger
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Customer / supplier
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="basic"
          className="mt-0 min-h-0 flex-1 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <BasicLedgerTab onExportReady={setBasicExport} />
        </TabsContent>
        <TabsContent
          value="contacts"
          className="mt-0 min-h-0 flex-1 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <CustomerSupplierLedgerTab onExportReady={setContactsExport} />
        </TabsContent>
      </Tabs>
    </AppPageShell>
  );
}
