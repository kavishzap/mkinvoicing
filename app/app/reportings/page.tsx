"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, FileDown, Loader2, Receipt, TrendingUp, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPageShell } from "@/components/app-page-shell";
import { DriverSettlementReportTab } from "@/components/driver-settlement-report-tab";
import { ExpenseReportTab } from "@/components/expense-report-tab";
import { PnlReportTab } from "@/components/pnl-report-tab";
import { SalesReportTab } from "@/components/sales-report-tab";
import type { ReportTabExportApi } from "@/components/report-tab-export";

type ReportTab = "pnl" | "sales" | "driver-settlement" | "expense";

function parseTab(raw: string | null): ReportTab {
  if (raw === "sales") return "sales";
  if (raw === "driver-settlement") return "driver-settlement";
  if (raw === "expense") return "expense";
  return "pnl";
}

export default function ReportingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState<ReportTab>(() =>
    parseTab(searchParams.get("tab")),
  );
  const [pnlExport, setPnlExport] = useState<ReportTabExportApi | null>(null);
  const [salesExport, setSalesExport] = useState<ReportTabExportApi | null>(null);
  const [driverSettlementExport, setDriverSettlementExport] =
    useState<ReportTabExportApi | null>(null);
  const [expenseExport, setExpenseExport] = useState<ReportTabExportApi | null>(null);

  useEffect(() => {
    setMainTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  const activeExport = useMemo(() => {
    if (mainTab === "sales") return salesExport;
    if (mainTab === "driver-settlement") return driverSettlementExport;
    if (mainTab === "expense") return expenseExport;
    return pnlExport;
  }, [mainTab, pnlExport, salesExport, driverSettlementExport, expenseExport]);

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
          router.replace(`/app/reportings?tab=${tab}`, { scroll: false });
        }}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1 p-1 sm:grid-cols-4 sm:inline-flex sm:w-auto">
          <TabsTrigger value="pnl" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Profit &amp; loss
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5 text-xs sm:text-sm">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Sales
          </TabsTrigger>
          <TabsTrigger value="driver-settlement" className="gap-1.5 text-xs sm:text-sm">
            <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Driver settlement
          </TabsTrigger>
          <TabsTrigger value="expense" className="gap-1.5 text-xs sm:text-sm">
            <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Expenses
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="pnl"
          className="mt-0 min-h-0 flex-1 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <PnlReportTab onExportReady={setPnlExport} />
        </TabsContent>
        <TabsContent
          value="sales"
          className="mt-0 min-h-0 flex-1 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <SalesReportTab onExportReady={setSalesExport} />
        </TabsContent>
        <TabsContent
          value="driver-settlement"
          className="mt-0 min-h-0 flex-1 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <DriverSettlementReportTab onExportReady={setDriverSettlementExport} />
        </TabsContent>
        <TabsContent
          value="expense"
          className="mt-0 min-h-0 flex-1 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ExpenseReportTab onExportReady={setExpenseExport} />
        </TabsContent>
      </Tabs>
    </AppPageShell>
  );
}
