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
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DIRECTORY_LIST_PANEL_CLASS,
  DirectoryFilterPanel,
  DirectoryFilterToggleButton,
  DirectoryListFrame,
  DirectoryListSearchHeader,
} from "@/components/directory-list-layout";
import { ResponsivePageActions } from "@/components/responsive-page-actions";
import { useDirectoryFiltersOpen } from "@/hooks/use-directory-filters-open";
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
  driverSettlementStatusRank,
  getDelivery,
  listDeliveries,
  type DeliveryListRow,
  type DeliveryNoteStatus,
} from "@/lib/deliveries-service";
import { drawMoLedgerExportPdfHeader } from "@/lib/mo-ledger-export-pdf";

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

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortDeliveryId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function newDeliveryIdsForDate(
  rows: DeliveryListRow[],
  day: string,
): Set<string> {
  const trimmed = day.trim();
  if (!trimmed) return new Set();
  return new Set(
    rows
      .filter(
        (r) =>
          r.status === "new" &&
          (r.deliveryDate ?? "").slice(0, 10) === trimmed,
      )
      .map((r) => r.id),
  );
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
  const [filtersOpen, setFiltersOpen] = useDirectoryFiltersOpen();

  const listRequestGen = useRef(0);
  const prevListDepsRef = useRef({
    debouncedSearch: "",
    statusFilter: "all" as DeliveryListStatusFilter,
    pageSize: 10,
    activeCompanyScope: 0,
  });
  const [isStoreKeeperModalOpen, setIsStoreKeeperModalOpen] = useState(false);
  const [storeKeeperDateFilter, setStoreKeeperDateFilter] = useState(() =>
    toLocalDateStr(new Date()),
  );
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<Set<string>>(
    new Set()
  );
  const [generatingStoreKeeperList, setGeneratingStoreKeeperList] = useState(false);

  function applyDefaultStoreKeeperSelection(day: string) {
    setSelectedDeliveryIds(newDeliveryIdsForDate(rows, day));
  }

  useEffect(() => {
    if (!isStoreKeeperModalOpen || !listLoaded) return;
    setSelectedDeliveryIds((prev) => {
      if (prev.size > 0) return prev;
      return newDeliveryIdsForDate(rows, storeKeeperDateFilter);
    });
  }, [isStoreKeeperModalOpen, listLoaded, rows, storeKeeperDateFilter]);

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

  const storeKeeperModalRows = useMemo(() => {
    const day = storeKeeperDateFilter.trim();
    if (!day) return [];
    return rows.filter((r) => (r.deliveryDate ?? "").slice(0, 10) === day);
  }, [rows, storeKeeperDateFilter]);

  const allStoreKeeperSelected =
    storeKeeperModalRows.length > 0 &&
    storeKeeperModalRows.every((r) => selectedDeliveryIds.has(r.id));

  const someStoreKeeperSelected =
    !allStoreKeeperSelected &&
    storeKeeperModalRows.some((r) => selectedDeliveryIds.has(r.id));

  function setStoreKeeperDate(day: string) {
    setStoreKeeperDateFilter(day);
    applyDefaultStoreKeeperSelection(day);
  }

  function shiftStoreKeeperDate(days: number) {
    const d = new Date(`${storeKeeperDateFilter}T12:00:00`);
    d.setDate(d.getDate() + days);
    setStoreKeeperDate(toLocalDateStr(d));
  }

  function toggleSelectAllStoreKeeper(checked: boolean) {
    if (checked) {
      setSelectedDeliveryIds(new Set(storeKeeperModalRows.map((r) => r.id)));
    } else {
      setSelectedDeliveryIds(new Set());
    }
  }

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

      const productDriverQtyMap = new Map<
        string,
        { product: string; driver: string; qty: number }
      >();
      for (const delivery of validDetails) {
        const driver = delivery.driverDisplay?.trim() || "—";
        for (const so of delivery.salesOrders) {
          for (const item of so.items ?? []) {
            const product = String(item.item ?? "").trim() || "Unnamed product";
            const qty = Number(item.quantity ?? 0);
            const key = `${product}\0${driver}`;
            const existing = productDriverQtyMap.get(key);
            if (existing) {
              existing.qty += qty;
            } else {
              productDriverQtyMap.set(key, { product, driver, qty });
            }
          }
        }
      }

      const rowsForPdf = [...productDriverQtyMap.values()]
        .sort(
          (a, b) =>
            a.driver.localeCompare(b.driver) ||
            a.product.localeCompare(b.product),
        )
        .map(({ product, driver, qty }, idx) => [
          String(idx + 1),
          product,
          String(qty),
          driver,
          "",
        ]);

      const filterLabel = fmtScheduleDay(storeKeeperDateFilter);

      const jsPDFModule = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const jsPDF = jsPDFModule.default;
      const autoTable = autoTableModule.default;

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
        rightSubtitle: `Delivery date: ${filterLabel} · ${selectedIds.length} note${selectedIds.length === 1 ? "" : "s"}`,
      });

      let y = 88;
      doc.setFont("helvetica", "bold").setFontSize(11).text("List details", margin, y);
      doc.setFont("helvetica", "normal").setFontSize(10);
      y += 16;
      doc.text(`Generated: ${generatedAt}`, margin, y);
      y += 14;
      doc.text(`Delivery date: ${filterLabel}`, margin, y);
      y += 20;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["No", "Product", "Qty", "Driver", "Remark"]],
        body:
          rowsForPdf.length > 0
            ? rowsForPdf
            : [["1", "No items", "0", "—", ""]],
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
          0: { halign: "center", cellWidth: 36 },
          1: { cellWidth: "auto" },
          2: { halign: "right", cellWidth: 56 },
          3: { cellWidth: 120 },
          4: { cellWidth: 100 },
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

      const filename = `StoreKeeperList-${storeKeeperDateFilter}.pdf`;
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
        id: "moneyDue",
        accessorFn: (r) => r.driverDueAmount ?? -1,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Money due" />
        ),
        cell: ({ row }) => {
          const due = row.original.driverDueAmount;
          if (due == null || due <= 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span className="tabular-nums font-medium text-red-700">
              {fmtMoney(due)}
            </span>
          );
        },
        meta: { tdClassName: "text-right" },
      },
      {
        id: "settlement",
        accessorFn: (r) => driverSettlementStatusRank(r.driverSettlementStatus),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Settlement" />
        ),
        cell: ({ row }) => (
          <DeliveryDriverSettlementBadge
            status={row.original.driverSettlementStatus}
          />
        ),
      },
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
    ],
    [],
  );

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      actions={
        <ResponsivePageActions>
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
        </ResponsivePageActions>
      }
      topbarTrailingBeforeTheme={
        showDirectory ? (
          <DirectoryFilterToggleButton
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            panelId="delivery-notes-filter-panel"
            label="delivery filters"
          />
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
        <DirectoryListFrame filtersOpen={filtersOpen}>
          <DirectoryFilterPanel
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            panelId="delivery-notes-filter-panel"
            title="Delivery filters"
          >
            <DeliveryNotesFilterSidebar
              facets={facets}
              statusFilter={statusFilter}
              onStatusChange={(v) => {
                setPage(1);
                setStatusFilter(v);
              }}
            />
          </DirectoryFilterPanel>
          <div className={DIRECTORY_LIST_PANEL_CLASS}>
            <DirectoryListSearchHeader trailing={listRangeLabel}>
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
            </DirectoryListSearchHeader>
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
                    pageSizeOptions={[10, 50, 100, 200]}
                  />
                }
              />
            </div>
          </div>
        </DirectoryListFrame>
      ) : null}
      <Dialog
        open={isStoreKeeperModalOpen}
        onOpenChange={(open) => {
          setIsStoreKeeperModalOpen(open);
          if (open) {
            applyDefaultStoreKeeperSelection(storeKeeperDateFilter);
          } else {
            setSelectedDeliveryIds(new Set());
          }
        }}
      >
        <DialogContent className="flex max-h-[min(92dvh,900px)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh] sm:w-full sm:max-w-4xl sm:gap-4 sm:p-6 lg:max-w-[52rem]">
          <DialogHeader className="shrink-0 space-y-2 border-b border-border/60 px-4 py-4 text-left sm:border-0 sm:px-0 sm:py-0">
            <DialogTitle>Prepare store keeper list</DialogTitle>
            <DialogDescription className="text-left">
              Choose a delivery date, select delivery notes, then print or
              download the product list grouped by driver.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-0 sm:py-0">
            <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="store-keeper-date">Delivery date</Label>
                <Input
                  id="store-keeper-date"
                  type="date"
                  value={storeKeeperDateFilter}
                  onChange={(e) => setStoreKeeperDate(e.target.value)}
                  className="w-full bg-background sm:w-[168px]"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => setStoreKeeperDate(toLocalDateStr(new Date()))}
                  >
                    Today
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => shiftStoreKeeperDate(-1)}
                    aria-label="Previous day"
                  >
                    ←
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => shiftStoreKeeperDate(1)}
                    aria-label="Next day"
                  >
                    →
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:border-0 sm:pt-0">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {selectedDeliveryIds.size} of {storeKeeperModalRows.length}{" "}
                  selected
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    disabled={storeKeeperModalRows.length === 0}
                    onClick={() => toggleSelectAllStoreKeeper(true)}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    disabled={selectedDeliveryIds.size === 0}
                    onClick={() => toggleSelectAllStoreKeeper(false)}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>

            {storeKeeperModalRows.length === 0 ? (
              <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {rows.length === 0
                  ? "No delivery notes available."
                  : `No delivery notes scheduled for ${fmtScheduleDay(storeKeeperDateFilter)}.`}
              </div>
            ) : (
              <>
                <div className="divide-y rounded-md border md:hidden">
                  {storeKeeperModalRows.map((r) => (
                    <label
                      key={`store-keeper-mobile-${r.id}`}
                      className="flex cursor-pointer gap-3 px-3 py-3 active:bg-muted/30"
                    >
                      <Checkbox
                        className="mt-0.5 shrink-0"
                        checked={selectedDeliveryIds.has(r.id)}
                        onCheckedChange={(c) =>
                          toggleDeliverySelection(r.id, c === true)
                        }
                        aria-label={`Select delivery ${shortDeliveryId(r.id)}`}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/app/delivery-notes/${r.id}`}
                            className="font-semibold text-primary underline-offset-4 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {shortDeliveryId(r.id)}
                          </Link>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {r.orderCount} order{r.orderCount === 1 ? "" : "s"}
                          </span>
                        </div>
                        <p className="truncate text-sm font-medium">
                          {r.driverDisplay}
                        </p>
                        <DeliveryNoteStatusBadge status={r.status} />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="hidden max-h-[440px] overflow-auto rounded-md border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={
                              allStoreKeeperSelected
                                ? true
                                : someStoreKeeperSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(c) =>
                              toggleSelectAllStoreKeeper(c === true)
                            }
                            aria-label="Select all delivery notes for this date"
                            disabled={storeKeeperModalRows.length === 0}
                          />
                        </TableHead>
                        <TableHead>Delivery note</TableHead>
                        <TableHead>Delivery date</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {storeKeeperModalRows.map((r) => (
                        <TableRow key={`store-keeper-${r.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedDeliveryIds.has(r.id)}
                              onCheckedChange={(c) =>
                                toggleDeliverySelection(r.id, c === true)
                              }
                              aria-label={`Select delivery ${shortDeliveryId(r.id)}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <Link
                              href={`/app/delivery-notes/${r.id}`}
                              className="text-primary underline-offset-4 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {shortDeliveryId(r.id)}
                            </Link>
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                            {fmtScheduleDay(r.deliveryDate)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.driverDisplay}
                          </TableCell>
                          <TableCell>
                            <DeliveryNoteStatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.orderCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-4 py-4 sm:border-0 sm:px-0 sm:py-0">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsStoreKeeperModalOpen(false)}
              disabled={generatingStoreKeeperList}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => generateStoreKeeperList("print")}
              disabled={
                generatingStoreKeeperList || selectedDeliveryIds.size === 0
              }
            >
              <Printer className="mr-2 h-4 w-4" aria-hidden />
              {generatingStoreKeeperList ? "Generating..." : "Print"}
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => generateStoreKeeperList("download")}
              disabled={
                generatingStoreKeeperList || selectedDeliveryIds.size === 0
              }
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
