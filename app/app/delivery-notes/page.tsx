"use client";
import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Check,
  Download,
  Plus,
  Printer,
  PackageOpen,
  Search,
  SlidersVertical,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { cn } from "@/lib/utils";
import { DeliveryNoteStatusBadge } from "@/components/delivery-note-status-badge";
import { DeliveryDriverSettlementBadge } from "@/components/delivery-driver-balance-status-badge";
import {
  DELIVERY_NOTE_STATUSES,
  DELIVERY_NOTE_STATUS_LABELS,
  getDelivery,
  listDeliveries,
  type DeliveryListRow,
  type DeliveryNoteStatus,
} from "@/lib/deliveries-service";
import { drawMoLedgerExportPdfHeader } from "@/lib/mo-ledger-export-pdf";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type DeliveryListStatusFilter = DeliveryNoteStatus | "all";

type DeliveryListFacets = {
  companyTotal: number;
  byStatus: Record<DeliveryNoteStatus, number>;
};

function computeDeliveryListFacets(rows: DeliveryListRow[]): DeliveryListFacets {
  const byStatus: Record<DeliveryNoteStatus, number> = {
    new: 0,
    delivered_to_driver: 0,
    completed: 0,
  };
  for (const r of rows) {
    byStatus[r.status] += 1;
  }
  return { companyTotal: rows.length, byStatus };
}

const DELIVERY_STATUS_FILTER_ICONS: Record<
  DeliveryListStatusFilter,
  LucideIcon
> = {
  all: PackageOpen,
  new: Plus,
  delivered_to_driver: Truck,
  completed: Check,
};

function DeliveryNotesFilterSidebar({
  id,
  facets,
  statusFilter,
  onStatusChange,
}: {
  id?: string;
  facets: DeliveryListFacets;
  statusFilter: DeliveryListStatusFilter;
  onStatusChange: (v: DeliveryListStatusFilter) => void;
}) {
  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  const statusRows: {
    id: DeliveryListStatusFilter;
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All deliveries",
      icon: DELIVERY_STATUS_FILTER_ICONS.all,
      count: facets.companyTotal,
    },
    ...DELIVERY_NOTE_STATUSES.map((s) => ({
      id: s,
      label: DELIVERY_NOTE_STATUS_LABELS[s],
      icon: DELIVERY_STATUS_FILTER_ICONS[s],
      count: facets.byStatus[s],
    })),
  ];

  return (
    <aside id={id} className="w-full shrink-0 lg:self-stretch">
      <div className="space-y-7 py-1">
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By status
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by status">
            {statusRows.map((item) => {
              const Icon = item.icon;
              const selected = statusFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onStatusChange(item.id)}
                  aria-pressed={selected}
                  className={cn(
                    rowBtn,
                    selected
                      ? "bg-muted/90 font-semibold text-foreground shadow-none"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-75" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span
                    className={cn(
                      "inline-flex min-w-[1.625rem] shrink-0 items-center justify-center rounded-full",
                      "bg-muted/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-muted-foreground",
                      "dark:bg-muted/70",
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `MUR ${n.toFixed(2)}`;
  }
}

function fmtScheduleDay(yyyyMmDd: string | null) {
  if (!yyyyMmDd?.trim()) return "—";
  try {
    return new Date(`${yyyyMmDd.trim()}T12:00:00`).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return yyyyMmDd;
  }
}

function deliverySearchText(r: DeliveryListRow): string {
  return [
    r.id,
    r.driverDisplay,
    r.createdByDisplay,
    DELIVERY_NOTE_STATUS_LABELS[r.status],
    r.status,
    fmtWhen(r.createdAt),
    fmtScheduleDay(r.deliveryDate),
    r.deliveryDate ?? "",
    String(r.orderCount),
    String(r.totalAmount),
  ]
    .join(" ")
    .toLowerCase();
}

export default function DeliveryNotesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<DeliveryListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listLoaded, setListLoaded] = useState(false);

  const [statusFilter, setStatusFilter] =
    useState<DeliveryListStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const listRequestGen = useRef(0);
  const prevListDepsRef = useRef({
    debouncedSearch: "",
    statusFilter: "all" as DeliveryListStatusFilter,
    pageSize: 10,
    activeCompanyScope: 0,
  });
  const [isStoreKeeperModalOpen, setIsStoreKeeperModalOpen] = useState(false);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<Set<string>>(
    new Set()
  );
  const [generatingStoreKeeperList, setGeneratingStoreKeeperList] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      220,
    );
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const bump = () => setActiveCompanyScope((n) => n + 1);
    window.addEventListener(ACTIVE_COMPANY_CHANGED_EVENT, bump);
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_COMPANY_ID_STORAGE_KEY) bump();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ACTIVE_COMPANY_CHANGED_EVENT, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getActiveCompanyId();
      if (cancelled) return;
      setCompanyReady(!!id);
      if (!id) {
        setRows([]);
        setListLoaded(true);
        setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyScope]);

  useEffect(() => {
    if (companyReady !== true) return;

    const prev = prevListDepsRef.current;
    const filterDepsChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.statusFilter !== statusFilter ||
      prev.pageSize !== pageSize;

    if (filterDepsChanged && page !== 1) {
      setPage(1);
    }

    prevListDepsRef.current = {
      debouncedSearch,
      statusFilter,
      pageSize,
      activeCompanyScope,
    };
  }, [debouncedSearch, statusFilter, pageSize, page, activeCompanyScope]);

  useEffect(() => {
    if (companyReady !== true) return;

    const gen = ++listRequestGen.current;
    let cancelled = false;

    (async () => {
      setListLoading(true);
      try {
        const list = await listDeliveries();
        if (cancelled || gen !== listRequestGen.current) return;
        setRows(list);
        setListLoaded(true);
      } catch (e: unknown) {
        if (cancelled || gen !== listRequestGen.current) return;
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Failed to load deliveries",
          description: msg,
          variant: "destructive",
        });
      } finally {
        if (!cancelled && gen === listRequestGen.current) {
          setListLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable
  }, [companyReady, activeCompanyScope]);

  const facets = useMemo(() => computeDeliveryListFacets(rows), [rows]);

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return deliverySearchText(r).includes(q);
    });
  }, [rows, statusFilter, debouncedSearch]);

  const total = filteredRows.length;

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const hasActiveFilters = useMemo(
    () => debouncedSearch !== "" || statusFilter !== "all",
    [debouncedSearch, statusFilter],
  );

  const listRangeLabel = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, total);
    if (total === 0) return "0–0 of 0";
    return `${from}–${to} of ${total}`;
  }, [total, page, pageSize]);

  const showSkeleton =
    companyReady !== false && !listLoaded && listLoading;

  const showDirectory = companyReady === true && listLoaded;

  const storeKeeperModalRows = useMemo(
    () => rows.filter((r) => r.status === "new"),
    [rows],
  );

  function toggleDeliverySelection(id: string, checked: boolean) {
    setSelectedDeliveryIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function generateStoreKeeperList(mode: "download" | "print") {
    if (selectedDeliveryIds.size === 0) {
      toast({
        title: "Select delivery notes",
        description: "Choose at least one delivery note to generate the list.",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingStoreKeeperList(true);
      const selectedIds = [...selectedDeliveryIds];
      const details = await Promise.all(selectedIds.map((id) => getDelivery(id)));
      const validDetails = details.filter((d) => d != null);

      if (validDetails.length === 0) {
        toast({
          title: "Nothing to generate",
          description: "Could not load selected delivery notes.",
          variant: "destructive",
        });
        return;
      }

      const productQtyMap = new Map<string, number>();
      for (const delivery of validDetails) {
        for (const so of delivery.salesOrders) {
          for (const item of so.items ?? []) {
            const product = String(item.item ?? "").trim() || "Unnamed product";
            const qty = Number(item.quantity ?? 0);
            productQtyMap.set(product, (productQtyMap.get(product) ?? 0) + qty);
          }
        }
      }

      const rowsForPdf = [...productQtyMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([product, qty], idx) => [String(idx + 1), product, String(qty), ""]);

      const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      const generatedAt = new Date().toLocaleString("en-GB");

      drawMoLedgerExportPdfHeader(doc, {
        margin,
        pageW,
        leftSubtitle: "Store operations export",
        rightTitle: "STORE KEEPER LIST",
        rightSubtitle: `Ref count: ${selectedIds.length}`,
      });

      let y = 88;
      doc.setFont("helvetica", "bold").setFontSize(11).text("List details", margin, y);
      doc.setFont("helvetica", "normal").setFontSize(10);
      y += 16;
      doc.text(`Generated: ${generatedAt}`, margin, y);
      y += 20;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["No", "Product", "Qty", "Remark"]],
        body: rowsForPdf.length > 0 ? rowsForPdf : [["1", "No items", "0", ""]],
        styles: {
          font: "helvetica",
          fontSize: 10,
          cellPadding: 6,
          lineColor: 230,
          lineWidth: 0.4,
          valign: "middle",
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 40 },
          1: { cellWidth: "auto" },
          2: { halign: "right", cellWidth: 70 },
          3: { cellWidth: 140 },
        },
      });

      const afterTable =
        (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? y;
      y = afterTable + 24;

      if (y > pageH - 170) {
        doc.addPage();
        y = margin;
      }

      doc.setFont("helvetica", "bold").setFontSize(11).text("Acknowledgement", margin, y);
      y += 14;
      doc.setFont("helvetica", "normal").setFontSize(9);
      const ack = doc.splitTextToSize(
        "I confirm that the products and quantities listed above are prepared for dispatch and verified by the store keeper.",
        pageW - margin * 2
      );
      doc.text(ack, margin, y);
      y += (Array.isArray(ack) ? ack.length : 1) * 12 + 20;

      const gap = 36;
      const colW = (pageW - 2 * margin - gap) / 2;
      const xRight = margin + colW + gap;
      doc.setDrawColor(0);
      doc.setFont("helvetica", "bold").setFontSize(10).text("Prepared by", margin, y);
      doc.line(margin, y + 38, margin + colW, y + 38);
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(80);
      doc.text("Signature and date", margin, y + 50);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold").setFontSize(10).text("Checked by", xRight, y);
      doc.line(xRight, y + 38, xRight + colW, y + 38);
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(80);
      doc.text("Signature and date", xRight, y + 50);
      doc.setTextColor(0);

      doc.setDrawColor(230);
      doc.line(margin, pageH - 42, pageW - margin, pageH - 42);
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor("#64748B");
      doc.text("Powered by MoLedger", pageW / 2, pageH - 28, { align: "center" });
      doc.text(`Page 1`, pageW - margin, pageH - 28, {
        align: "right",
      });
      doc.setTextColor(0);

      const filename = `StoreKeeperList-${new Date().toISOString().slice(0, 10)}.pdf`;
      if (mode === "print") {
        const pdfBlob = doc.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(pdfUrl, "_blank");
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => printWindow.print(), 250);
          };
        } else {
          doc.save(filename);
          toast({
            title: "Print blocked",
            description: "Allow popups to print. PDF downloaded instead.",
          });
        }
      } else {
        doc.save(filename);
      }
      setIsStoreKeeperModalOpen(false);
      setSelectedDeliveryIds(new Set());
      toast({
        title: mode === "print" ? "Opening print dialog" : "List generated",
        description: filename,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Failed to generate list",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingStoreKeeperList(false);
    }
  }

  const columns = useMemo<ColumnDef<DeliveryListRow>[]>(
    () => [
      {
        id: "createdAt",
        accessorFn: (r) => r.createdAt,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {fmtWhen(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "createdBy",
        accessorFn: (r) => r.createdByDisplay,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created by" />
        ),
        cell: ({ row }) => row.original.createdByDisplay || "—",
        meta: { tdClassName: "text-muted-foreground" },
      },
      {
        id: "deliveryDate",
        accessorFn: (r) => r.deliveryDate ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Delivery date" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {fmtScheduleDay(row.original.deliveryDate)}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => r.status,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <DeliveryNoteStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "driver",
        accessorFn: (r) => r.driverDisplay,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Driver" />
        ),
        cell: ({ row }) => {
          const r = row.original;
          if (r.driverMembershipId) {
            return (
              <Link
                href={`/app/company-team/${r.driverMembershipId}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {r.driverDisplay}
              </Link>
            );
          }
          return <span className="font-medium">{r.driverDisplay}</span>;
        },
        meta: { stopRowClick: true },
      },
      {
        id: "orderCount",
        accessorFn: (r) => r.orderCount,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Orders" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.orderCount}</span>
        ),
        meta: { tdClassName: "text-right" },
      },
      {
        id: "totalAmount",
        accessorFn: (r) => r.totalAmount,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {fmtMoney(row.original.totalAmount)}
          </span>
        ),
        meta: { tdClassName: "text-right" },
      },
      {
        id: "moneyCollected",
        accessorFn: (r) => r.driverCollectedAmount ?? -1,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Money collected" />
        ),
        cell: ({ row }) => {
          const r = row.original;
          if (r.driverCollectedAmount == null) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span className="tabular-nums font-medium">
              {fmtMoney(r.driverCollectedAmount)}
            </span>
          );
        },
        meta: { tdClassName: "text-right" },
      },
      {
        id: "settlement",
        accessorFn: (r) => (r.driverStatus ? 1 : 0),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Settlement" />
        ),
        cell: ({ row }) => (
          <DeliveryDriverSettlementBadge settled={row.original.driverStatus} />
        ),
      },
    ],
    [],
  );

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      actions={
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={companyReady !== true || listLoading}
            onClick={() => setIsStoreKeeperModalOpen(true)}
          >
            Prepare store keeper list
          </Button>
          <Button
            asChild
            size="sm"
            className="gap-2"
            disabled={companyReady !== true}
          >
            <Link href="/app/delivery-notes/new">
              <Plus className="h-4 w-4" />
              New delivery
            </Link>
          </Button>
        </div>
      }
      topbarTrailingBeforeTheme={
        showDirectory ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 text-muted-foreground",
              filtersOpen && "bg-primary/15 text-primary",
            )}
            aria-label={
              filtersOpen ? "Hide delivery filters" : "Show delivery filters"
            }
            aria-expanded={filtersOpen}
            aria-controls="delivery-notes-filter-panel"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersVertical className="h-4 w-4" aria-hidden />
          </Button>
        ) : null
      }
    >
      {companyReady === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company is linked to this account yet. Delivery notes are
            scoped to your active company.
          </CardContent>
        </Card>
      )}

      {showSkeleton ? (
        <DirectoryListPageSkeleton className="min-h-0 flex-1" />
      ) : null}

      {showDirectory ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0",
            filtersOpen ? "gap-6" : "gap-0",
          )}
        >
          <div
            id="delivery-notes-filter-panel"
            className={cn(
              "shrink-0 overflow-hidden",
              "transition-[width,margin-inline-end,max-height,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
              "motion-reduce:transition-none motion-reduce:duration-0",
              filtersOpen
                ? "pointer-events-auto max-h-[2000px] opacity-100 lg:me-10 lg:w-56 xl:w-[15rem]"
                : "pointer-events-none max-h-0 opacity-0 lg:pointer-events-none lg:max-h-none lg:w-0 lg:opacity-100 xl:w-0 lg:me-0",
            )}
            aria-hidden={!filtersOpen}
          >
            <div className="h-full min-w-0 w-full lg:min-w-[14rem] xl:min-w-[15rem]">
              <DeliveryNotesFilterSidebar
                facets={facets}
                statusFilter={statusFilter}
                onStatusChange={(v) => {
                  setPage(1);
                  setStatusFilter(v);
                }}
              />
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-border/50 bg-card text-card-foreground shadow-none outline outline-1 -outline-offset-1 outline-border/40 dark:border-border/60 dark:outline-border/50">
            <div className="flex shrink-0 flex-col gap-3 border-b border-border/50 bg-muted/45 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 dark:bg-muted/25">
              <div className="relative min-w-0 flex-1 sm:max-w-xl lg:max-w-2xl">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ID, driver, status, or date…"
                  className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                  aria-label="Search delivery notes"
                  autoComplete="off"
                />
              </div>
              <p className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-right">
                {listRangeLabel}
              </p>
            </div>
            <div
              className={cn(
                "relative flex min-h-0 flex-1 flex-col transition-opacity duration-150 ease-out",
                listLoading &&
                  "pointer-events-none opacity-[0.58] motion-reduce:transition-none",
              )}
              aria-busy={listLoading}
            >
              <DataTable
                className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
                tableContainerClassName="min-h-0 flex-1 overflow-auto"
                variant="minimal"
                columns={columns}
                data={paginatedRows}
                manualFiltering
                hideSearch
                onRowClick={(r) => router.push(`/app/delivery-notes/${r.id}`)}
                getRowId={(r) => r.id}
                emptyMessage={
                  hasActiveFilters ? (
                    <FeatureEmptyState
                      title="No deliveries match your filters"
                      description="Try clearing search or adjusting status."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPage(1);
                            setSearchQuery("");
                            setStatusFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : facets.companyTotal === 0 ? (
                    <FeatureEmptyState
                      icon={PackageOpen}
                      title="No delivery notes yet"
                      description="Create a delivery to assign sales orders to a driver."
                      action={
                        <Button asChild variant="outline" size="sm">
                          <Link href="/app/delivery-notes/new">New delivery</Link>
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : (
                    <FeatureEmptyState
                      title="No deliveries on this page"
                      description="Try another page."
                      className="border-0 bg-transparent py-8"
                    />
                  )
                }
                footer={
                  <DataTablePaginationFooter
                    variant="minimal"
                    total={total}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    pageSizeOptions={[10, 25, 50]}
                  />
                }
              />
            </div>
          </div>
        </div>
      ) : null}
      <Dialog
        open={isStoreKeeperModalOpen}
        onOpenChange={(open) => {
          setIsStoreKeeperModalOpen(open);
          if (!open) setSelectedDeliveryIds(new Set());
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prepare store keeper list</DialogTitle>
            <DialogDescription>
              Only delivery notes in <span className="font-medium text-foreground">New</span>{" "}
              status are listed. Select one or more to generate a Product + Qty PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Created</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeKeeperModalRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {rows.length === 0
                        ? "No delivery notes available."
                        : "No delivery notes in New status. Advance or complete other notes before they appear here."}
                    </TableCell>
                  </TableRow>
                ) : (
                  storeKeeperModalRows.map((r) => (
                    <TableRow key={`store-keeper-${r.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedDeliveryIds.has(r.id)}
                          onCheckedChange={(c) =>
                            toggleDeliverySelection(r.id, c === true)
                          }
                          aria-label={`Select delivery ${r.id}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {fmtWhen(r.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.createdByDisplay || "—"}
                      </TableCell>
                      <TableCell>
                        <DeliveryNoteStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="font-medium">{r.driverDisplay}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.orderCount}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStoreKeeperModalOpen(false)}
              disabled={generatingStoreKeeperList}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => generateStoreKeeperList("print")}
              disabled={generatingStoreKeeperList || storeKeeperModalRows.length === 0}
            >
              <Printer className="mr-2 h-4 w-4" aria-hidden />
              {generatingStoreKeeperList ? "Generating..." : "Print"}
            </Button>
            <Button
              type="button"
              onClick={() => generateStoreKeeperList("download")}
              disabled={generatingStoreKeeperList || storeKeeperModalRows.length === 0}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {generatingStoreKeeperList ? "Generating..." : "Download PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
