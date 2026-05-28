"use client";

import { TableBodyRowsSkeleton } from "@/components/page-skeletons";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  History,
  Package,
  RefreshCw,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  listInventoryMovements,
  listStockBalancesForLocation,
  type InventoryMovementRow,
  type StockBalanceRow,
} from "@/lib/inventory-stock-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { cn } from "@/lib/utils";

const linkClass =
  "font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

function LocationProductLink({
  productId,
  name,
  sku,
}: {
  productId: string;
  name: string;
  sku?: string;
}) {
  return (
    <div>
      <Link href={`/app/products/${productId}/edit`} className={cn(linkClass, "font-semibold")}>
        {name}
      </Link>
      {sku ? <span className="block text-xs text-muted-foreground">{sku}</span> : null}
    </div>
  );
}

function LocationMovementLink({
  locationId,
  label,
}: {
  locationId: string;
  label: string;
}) {
  return (
    <Link
      href={`/app/locations/${locationId}?tab=products-line`}
      className={linkClass}
    >
      {label}
    </Link>
  );
}

function CollapsibleInventorySection({
  icon: Icon,
  title,
  count,
  defaultOpen = true,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="flex min-w-0 flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer rounded-none border-b bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <div className="flex w-full min-w-0 flex-row items-start gap-2.5">
              <ChevronDown
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform collapsible-open:rotate-180"
                aria-hidden
              />
              <Icon
                className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1 text-left">
                <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base leading-snug">
                  <span className="min-w-0 break-words">{title}</span>
                  {count !== undefined ? (
                    <span className="rounded-full bg-muted/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground dark:bg-muted/70">
                      {count}
                    </span>
                  ) : null}
                </CardTitle>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="min-w-0 px-4 py-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function MovementDetailCell({ m }: { m: InventoryMovementRow }) {
  if (m.event_type === "transfer") {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
        {m.from_location_id && m.from_label !== "—" ? (
          <LocationMovementLink locationId={m.from_location_id} label={m.from_label} />
        ) : (
          <span>{m.from_label}</span>
        )}
        <span aria-hidden>→</span>
        {m.to_location_id && m.to_label !== "—" ? (
          <LocationMovementLink locationId={m.to_location_id} label={m.to_label} />
        ) : (
          <span>{m.to_label}</span>
        )}
      </span>
    );
  }
  if (m.event_type === "refill") {
    return (
      <span className="text-xs text-muted-foreground">
        Into{" "}
        {m.to_location_id && m.to_label !== "—" ? (
          <LocationMovementLink locationId={m.to_location_id} label={m.to_label} />
        ) : (
          m.to_label
        )}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      From{" "}
      {m.from_location_id && m.from_label !== "—" ? (
        <LocationMovementLink locationId={m.from_location_id} label={m.from_label} />
      ) : (
        m.from_label
      )}
    </span>
  );
}

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

async function generateLocationInventoryPdf(params: {
  locationDisplay: string;
  balances: StockBalanceRow[];
  movements: InventoryMovementRow[];
  profile: Profile | null;
}) {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.default;

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
    m.event_type === "transfer"
      ? `${m.from_label} → ${m.to_label}`
      : m.event_type === "refill"
        ? `Into ${m.to_label}`
        : `From ${m.from_label}`,
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
  const [productSearch, setProductSearch] = useState("");
  const loadRequestGen = useRef(0);

  const locationDisplay = locationCode
    ? `${locationName} (${locationCode})`
    : locationName;

  useEffect(() => {
    setMovPage(1);
    setProductSearch("");
  }, [locationId]);

  const filteredBalances = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return balances;
    return balances.filter((b) => {
      const name = (b.product_name ?? "").toLowerCase();
      const sku = (b.product_sku ?? "").toLowerCase();
      return name.includes(q) || sku.includes(q);
    });
  }, [balances, productSearch]);

  const load = useCallback(async () => {
    if (!locationId || !enabled) return;
    const gen = ++loadRequestGen.current;
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
      if (gen !== loadRequestGen.current) return;
      setBalances(bal);
      setMovRows(mov.rows);
      setMovTotal(mov.total);
    } catch (e: unknown) {
      if (gen !== loadRequestGen.current) return;
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
      if (gen === loadRequestGen.current) {
        setLoading(false);
      }
    }
  }, [locationId, enabled, movPage]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable; errors only
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
      });
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
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

      <CollapsibleInventorySection
        icon={Package}
        title="Products at this location"
        count={
          loading
            ? undefined
            : productSearch.trim()
              ? filteredBalances.length
              : balances.length
        }
        defaultOpen
      >
        <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
              aria-hidden
            />
            <Input
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search by product name or SKU…"
              className="h-9 w-full pl-9 text-sm"
              aria-label="Search products at this location"
              autoComplete="off"
              disabled={loading}
            />
          </div>
          {!loading && balances.length > 0 ? (
            <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {productSearch.trim()
                ? `${filteredBalances.length} of ${balances.length}`
                : `${balances.length} product${balances.length === 1 ? "" : "s"}`}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 overflow-x-auto rounded-md border">
          <table className="w-full min-w-[28rem] text-sm">
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
                <TableBodyRowsSkeleton rowCount={4} colCount={4} />
              ) : balances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No on-hand stock at this location.
                  </td>
                </tr>
              ) : filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No products match your search.
                  </td>
                </tr>
              ) : (
                filteredBalances.map((b) => (
                  <tr key={b.product_id} className="border-t">
                    <td className="p-3">
                      <LocationProductLink
                        productId={b.product_id}
                        name={b.product_name}
                        sku={b.product_sku || undefined}
                      />
                    </td>
                    <td className="p-3 text-muted-foreground">{b.product_sku || "—"}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{b.quantity}</td>
                    <td className="p-3 text-xs tabular-nums text-muted-foreground">
                      {formatWhen(b.balance_updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleInventorySection>

      <CollapsibleInventorySection
        icon={History}
        title="Transfers, refills & stock-outs"
        count={loading ? undefined : movTotal}
        defaultOpen
      >
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-md border">
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
                <TableBodyRowsSkeleton rowCount={5} colCount={7} />
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
                      <td className="max-w-[14rem] break-words p-3 sm:max-w-[18rem]">
                        <LocationProductLink
                          productId={m.product_id}
                          name={m.product_name}
                          sku={m.product_sku || undefined}
                        />
                      </td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums font-medium">
                        {m.quantity}
                      </td>
                      <td className="max-w-[16rem] break-words p-3 sm:max-w-[22rem]">
                        <MovementDetailCell m={m} />
                      </td>
                      <td className="max-w-[16rem] break-words p-3 text-xs text-muted-foreground sm:max-w-[22rem]">
                        {m.note || "—"}
                      </td>
                      <td className="max-w-[10rem] break-words p-3 text-xs sm:max-w-[12rem]">
                        {m.recorded_by_label}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && movTotal > 0 ? (
            <div className="flex shrink-0 flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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
        </div>
      </CollapsibleInventorySection>
    </div>
  );
}
