"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  listInventoryMovements,
  listStockBalancesForLocation,
  type InventoryMovementRow,
  type StockBalanceRow,
} from "@/lib/inventory-stock-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const EVENT_LABELS: Record<InventoryMovementRow["event_type"], string> = {
  transfer: "Transfer",
  refill: "Refill",
  adjustment_out: "Stock out",
};

function formatWhen(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function movementSummary(m: InventoryMovementRow): string {
  if (m.event_type === "transfer") {
    return `${m.from_label} → ${m.to_label}`;
  }
  if (m.event_type === "refill") {
    return `Into ${m.to_label}`;
  }
  return `From ${m.from_label}`;
}

async function generateLocationInventoryPdf(params: {
  locationDisplay: string;
  balances: StockBalanceRow[];
  movements: InventoryMovementRow[];
  profile: Profile | null;
}) {
  const { locationDisplay, balances, movements, profile } = params;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;
  const brandColor: [number, number, number] = [15, 23, 42];

  const senderName =
    profile?.companyName || profile?.fullName || "Your Company";

  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text("LOCATION INVENTORY", M, 34);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(senderName, pageW - M, 34, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 74;
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Location", M, y);
  y += 14;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(locationDisplay, M, y);
  y += 14;
  doc.text(`Generated: ${formatWhen(new Date().toISOString())}`, M, y);
  y += 28;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Products on hand", M, y);
  y += 8;

  const balanceBody = balances.map((b) => [
    b.product_name || "—",
    b.product_sku || "—",
    String(b.quantity),
  ]);

  autoTable(doc, {
    head: [["Product", "SKU", "Qty"]],
    body: balanceBody.length ? balanceBody : [["—", "—", "No rows"]],
    startY: y,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: brandColor, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      2: { halign: "right" },
    },
    margin: { left: M, right: M },
  });

  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y += 22;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Movement history (this location)", M, y);
  y += 8;

  const movBody = movements.map((m) => [
    formatWhen(m.created_at),
    EVENT_LABELS[m.event_type],
    m.product_name,
    String(m.quantity),
    movementSummary(m),
    m.note ? m.note.slice(0, 80) : "—",
    m.recorded_by_label,
  ]);

  autoTable(doc, {
    head: [["When", "Type", "Product", "Qty", "Route / detail", "Note", "Recorded by"]],
    body: movBody.length ? movBody : [["—", "—", "—", "—", "—", "—", "—"]],
    startY: y,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: brandColor, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      3: { halign: "right", cellWidth: 44 },
      0: { cellWidth: 72 },
      1: { cellWidth: 52 },
      4: { cellWidth: 78 },
      5: { cellWidth: 62 },
      6: { cellWidth: 54 },
    },
    margin: { left: M, right: M },
  });

  const fn = `Location-inventory-${locationDisplay.replace(/[^\w\-]+/g, "_").slice(0, 40)}.pdf`;
  doc.save(fn);
}

export function LocationProductsLineTab({
  locationId,
  locationName,
  locationCode,
  enabled,
}: {
  locationId: string;
  locationName: string;
  locationCode: string;
  /** Fetch when tab is visible to avoid extra requests. */
  enabled: boolean;
}) {
  const { toast } = useToast();
  const [balances, setBalances] = useState<StockBalanceRow[]>([]);
  const [movRows, setMovRows] = useState<InventoryMovementRow[]>([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movPage, setMovPage] = useState(1);
  const movPageSize = 20;
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  const locationDisplay = locationCode
    ? `${locationName} (${locationCode})`
    : locationName;

  useEffect(() => {
    setMovPage(1);
  }, [locationId]);

  const load = useCallback(async () => {
    if (!locationId || !enabled) return;
    setLoading(true);
    try {
      const [bal, mov] = await Promise.all([
        listStockBalancesForLocation(locationId),
        listInventoryMovements({
          locationId,
          page: movPage,
          pageSize: movPageSize,
        }),
      ]);
      setBalances(bal);
      setMovRows(mov.rows);
      setMovTotal(mov.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Could not load inventory",
        description: msg,
        variant: "destructive",
      });
      setBalances([]);
      setMovRows([]);
      setMovTotal(0);
    } finally {
      setLoading(false);
    }
  }, [locationId, enabled, movPage, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const movPages = Math.max(1, Math.ceil(movTotal / movPageSize));

  async function handleDownloadPdf() {
    setPdfBusy(true);
    try {
      const [bal, movRes, profile] = await Promise.all([
        listStockBalancesForLocation(locationId),
        listInventoryMovements({
          locationId,
          page: 1,
          pageSize: 2500,
        }),
        fetchProfile().catch(() => null),
      ]);
      await generateLocationInventoryPdf({
        locationDisplay,
        balances: bal,
        movements: movRes.rows,
        profile,
      });
    } catch (e: unknown) {
      toast({
        title: "PDF failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-4">
      <div className="flex min-w-0 w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 max-w-full text-sm text-muted-foreground sm:max-w-2xl">
          Read-only snapshot of stock held here and movements involving this location (transfers,
          refills, stock-outs). Use{" "}
          <span className="font-medium text-foreground">Inventory</span> to record changes.
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={pdfBusy || loading}
            onClick={() => void handleDownloadPdf()}
          >
            <Download className="h-4 w-4" />
            {pdfBusy ? "Building…" : "Download PDF"}
          </Button>
        </div>
      </div>

      <Card className="min-w-0">
        <CardHeader className="min-w-0 pb-3">
          <div className="flex min-w-0 items-start gap-2">
            <Package className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
            <div className="min-w-0">
              <CardTitle className="text-base leading-snug break-words">
                Products at this location
              </CardTitle>
              <CardDescription>
                Quantities from live balances (products with zero on hand are hidden).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="min-w-0 overflow-x-auto rounded-md border">
            <table className="w-full min-w-0 text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">SKU</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-left text-muted-foreground/80">Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : balances.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No on-hand stock at this location.
                    </td>
                  </tr>
                ) : (
                  balances.map((b) => (
                    <tr key={b.product_id} className="border-t">
                      <td className="p-3 font-medium">{b.product_name}</td>
                      <td className="p-3 text-muted-foreground">{b.product_sku || "—"}</td>
                      <td className="p-3 text-right tabular-nums font-medium">{b.quantity}</td>
                      <td className="p-3 text-muted-foreground text-xs tabular-nums">
                        {formatWhen(b.balance_updated_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="min-w-0 pb-3">
          <CardTitle className="text-base leading-snug break-words hyphens-auto">
            Transfers, refills & stock-outs
          </CardTitle>
          <CardDescription className="break-words">
            History rows where stock moved in or out of this location.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-md border">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="whitespace-nowrap p-3 text-left align-top">When</th>
                  <th className="whitespace-nowrap p-3 text-left align-top">Type</th>
                  <th className="p-3 text-left align-top">Product</th>
                  <th className="whitespace-nowrap p-3 text-right align-top">Qty</th>
                  <th className="p-3 text-left align-top">Detail</th>
                  <th className="p-3 text-left align-top">Note</th>
                  <th className="p-3 text-left align-top">By</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : movRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No movements recorded for this location yet.
                    </td>
                  </tr>
                ) : (
                  movRows.map((m) => (
                    <tr key={m.id} className="border-t align-top">
                      <td className="whitespace-nowrap p-3 text-xs tabular-nums text-muted-foreground">
                        {formatWhen(m.created_at)}
                      </td>
                      <td className="whitespace-nowrap p-3 text-xs">
                        {EVENT_LABELS[m.event_type]}
                      </td>
                      <td className="max-w-[14rem] p-3 break-words sm:max-w-[18rem]">
                        <span className="font-medium">{m.product_name}</span>
                        {m.product_sku ? (
                          <span className="block text-xs text-muted-foreground">{m.product_sku}</span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums font-medium">
                        {m.quantity}
                      </td>
                      <td className="max-w-[16rem] p-3 text-xs text-muted-foreground break-words sm:max-w-[22rem]">
                        {movementSummary(m)}
                      </td>
                      <td className="max-w-[16rem] p-3 text-xs text-muted-foreground break-words sm:max-w-[22rem]">
                        {m.note || "—"}
                      </td>
                      <td className="max-w-[10rem] p-3 text-xs break-words sm:max-w-[12rem]">
                        {m.recorded_by_label}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && movTotal > 0 ? (
            <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Page <span className="font-medium text-foreground">{movPage}</span> / {movPages}{" "}
                — {movTotal} movement(s)
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={movPage <= 1}
                  onClick={() => setMovPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={movPage >= movPages}
                  onClick={() => setMovPage((p) => Math.min(movPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
