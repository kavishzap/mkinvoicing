"use client";
import {
  FormTwoColumnPageSkeleton,
  InlineTableRowsSkeleton,
  SettingsTwoColumnSkeleton,
} from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  Info,
  ListOrdered,
  Save,
  Search,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppPageShell } from "@/components/app-page-shell";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { cn } from "@/lib/utils";
import {
  SALES_ORDER_FULFILLMENT_LABELS,
  SALES_ORDER_PAYMENT_LABELS,
} from "@/lib/sales-orders-service";
import { SalesOrderPaymentStatusBadge } from "@/components/sales-order-payment-status-badge";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  createDelivery,
  listDriverTeamMembers,
  listSalesOrdersForDelivery,
  type SalesOrderPickRow,
} from "@/lib/deliveries-service";
import type { TeamMemberRow } from "@/lib/company-team-service";
import {
  getDriverZoneCityFilter,
  type DriverZoneCityFilter,
} from "@/lib/delivery-zones-service";

function fmtSoDeliveryDate(yyyyMmDd: string | null | undefined) {
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

function fmtMoney(n: number, ccy: string | null | undefined, fractionDigits = 2) {
  const code =
    ccy && String(ccy).trim().length === 3
      ? String(ccy).trim().toUpperCase()
      : "MUR";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    }).format(n);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    }).format(n);
  }
}

function lineTotal(it: SalesOrderPickRow["items"][0]) {
  const line = Number(it.quantity) * Number(it.unit_price);
  const tax = line * (Number(it.tax_percent) / 100);
  return line + tax;
}

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

const deliveryFormGridClass =
  "grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-stretch lg:gap-8 xl:gap-10 [&>*]:min-w-0";

const ordersSearchInputClass =
  "h-8 w-full min-w-[10rem] rounded-md border border-border/75 bg-background pl-8 pr-3 text-xs shadow-sm placeholder:text-muted-foreground/55 focus-visible:ring-2 focus-visible:ring-primary/15 dark:bg-background";

const cellLinkClass =
  "font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

const tableCellClass = "align-middle text-sm";

const orderCheckboxWrapClass = "flex items-center justify-center";

const ordersEmptyStateClass =
  "flex min-h-[min(50vh,20rem)] flex-1 items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground";

function phoneDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function deliverySearchText(o: SalesOrderPickRow): string {
  const phone = (o.phone ?? "").trim();
  return [
    o.number,
    o.clientName,
    phone,
    phoneDigitsOnly(phone),
    o.email,
    o.city,
    SALES_ORDER_FULFILLMENT_LABELS[o.fulfillmentStatus],
    o.fulfillmentStatus,
    SALES_ORDER_PAYMENT_LABELS[o.paymentStatus],
    o.paymentStatus,
    o.deliveryDate ?? "",
    String(o.total),
    o.currency,
    ...o.items.flatMap((it) => [
      it.item,
      it.description ?? "",
      String(it.quantity),
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

function orderMatchesSearch(o: SalesOrderPickRow, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const haystack = deliverySearchText(o);
  if (haystack.includes(q.toLowerCase())) return true;
  const qDigits = phoneDigitsOnly(q);
  if (qDigits.length >= 2) {
    const phoneHay = phoneDigitsOnly(o.phone ?? "");
    if (phoneHay.includes(qDigits)) return true;
  }
  return false;
}

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
  headerRight,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "flex min-h-0 w-full max-w-full flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm",
        className,
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={sectionIconBoxClass}>
            <Icon className={sectionIconClass} aria-hidden />
          </div>
          <CardTitle className={sectionTitleClass}>{title}</CardTitle>
        </div>
        {headerRight ? (
          <div className="flex shrink-0 items-center">{headerRight}</div>
        ) : null}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 px-4 py-5 [&_input]:h-8 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs">
        {children}
      </CardContent>
    </Card>
  );
}

export default function NewDeliveryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [orders, setOrders] = useState<SalesOrderPickRow[]>([]);
  const [drivers, setDrivers] = useState<TeamMemberRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [driverId, setDriverId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(() =>
    new Date().toISOString().split("T")[0],
  );
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(10);
  const [ordersSearchQuery, setOrdersSearchQuery] = useState("");
  const [ordersDebouncedSearch, setOrdersDebouncedSearch] = useState("");
  const [ordersSorting, setOrdersSorting] = useState<SortingState>([]);
  const zoneReq = useRef(0);
  const [zoneForDriver, setZoneForDriver] = useState<{
    driverUserId: string;
    filter: DriverZoneCityFilter;
  } | null>(null);
  const [zoneLoading, setZoneLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [o, d] = await Promise.all([
          listSalesOrdersForDelivery(),
          listDriverTeamMembers(),
        ]);
        if (cancelled) return;
        setOrders(o);
        setDrivers(d);
      } catch (e: unknown) {
        if (!cancelled) {
          const err = e as { message?: string };
          toast({
            title: "Failed to load",
            description: err?.message ?? "Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setOrdersDebouncedSearch(ordersSearchQuery.trim()),
      220,
    );
    return () => window.clearTimeout(t);
  }, [ordersSearchQuery]);

  useEffect(() => {
    if (!driverId.trim()) {
      setZoneForDriver(null);
      setZoneLoading(false);
      return;
    }
    const seq = ++zoneReq.current;
    setZoneLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const filter = await getDriverZoneCityFilter(driverId);
        if (cancelled || seq !== zoneReq.current) return;
        setZoneForDriver({ driverUserId: driverId, filter });
      } catch (e: unknown) {
        if (cancelled || seq !== zoneReq.current) return;
        const err = e as { message?: string };
        toast({
          title: "Could not load driver route",
          description: err?.message ?? "Showing all eligible orders.",
          variant: "destructive",
        });
        setZoneForDriver({
          driverUserId: driverId,
          filter: {
            hasZoneAssignment: false,
            cityIds: [],
            cityNames: [],
            cityNamesLower: [],
          },
        });
      } finally {
        if (!cancelled && seq === zoneReq.current) setZoneLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId, toast]);

  const resolvedZoneFilter =
    zoneForDriver?.driverUserId === driverId ? zoneForDriver.filter : undefined;

  /** Orders with no SO delivery date always show; if SO has a date it must match the note date. */
  const dateFilteredOrders = useMemo(() => {
    const noteDate = deliveryDate.trim().slice(0, 10);
    if (!noteDate) return orders;
    return orders.filter((o) => {
      const so = o.deliveryDate?.trim();
      if (!so) return true;
      return so.slice(0, 10) === noteDate;
    });
  }, [orders, deliveryDate]);

  const visibleOrders = useMemo(() => {
    if (!driverId.trim()) return dateFilteredOrders;

    if (zoneLoading && resolvedZoneFilter === undefined) return [];

    if (!resolvedZoneFilter || !resolvedZoneFilter.hasZoneAssignment) {
      return dateFilteredOrders;
    }

    if (
      resolvedZoneFilter.cityIds.length === 0 &&
      resolvedZoneFilter.cityNamesLower.length === 0
    ) {
      return [];
    }

    const idSet = new Set(resolvedZoneFilter.cityIds);
    const nameSet = new Set(resolvedZoneFilter.cityNamesLower);

    return dateFilteredOrders.filter((o) => {
      if (o.cityId && idSet.has(o.cityId)) return true;
      const label = o.city.trim().toLowerCase();
      if (!o.cityId && label && nameSet.has(label)) return true;
      return false;
    });
  }, [dateFilteredOrders, driverId, resolvedZoneFilter, zoneLoading]);

  const searchFilteredOrders = useMemo(() => {
    if (!ordersDebouncedSearch) return visibleOrders;
    return visibleOrders.filter((o) =>
      orderMatchesSearch(o, ordersDebouncedSearch),
    );
  }, [visibleOrders, ordersDebouncedSearch]);

  useEffect(() => {
    const allow = new Set(searchFilteredOrders.map((o) => o.id));
    setSelected((prev) => {
      let dropped = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (allow.has(id)) next.add(id);
        else dropped = true;
      }
      if (!dropped && next.size === prev.size) return prev;
      return next;
    });
  }, [searchFilteredOrders]);

  useEffect(() => {
    setOrdersPage(1);
  }, [
    visibleOrders.length,
    searchFilteredOrders.length,
    driverId,
    deliveryDate,
    zoneLoading,
    ordersDebouncedSearch,
    ordersSorting,
  ]);

  const showDriverRouteInfo =
    Boolean(driverId.trim()) &&
    !zoneLoading &&
    Boolean(resolvedZoneFilter?.hasZoneAssignment);

  const driverRouteCities = useMemo(() => {
    if (!showDriverRouteInfo || !resolvedZoneFilter) return [];
    return resolvedZoneFilter.cityNames;
  }, [showDriverRouteInfo, resolvedZoneFilter]);

  const selectedList = useMemo(
    () => visibleOrders.filter((o) => selected.has(o.id)),
    [visibleOrders, selected]
  );
  const allSelected =
    searchFilteredOrders.length > 0 &&
    searchFilteredOrders.every((o) => selected.has(o.id));
  const someSelected =
    searchFilteredOrders.some((o) => selected.has(o.id)) && !allSelected;

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(searchFilteredOrders.map((o) => o.id)));
      return;
    }
    setSelected(new Set());
  }

  const selectedDriverLabel = useMemo(() => {
    const d = drivers.find((row) => row.userId === driverId);
    if (!d) return "selected driver";
    return (
      d.profile?.full_name?.trim() ||
      d.profile?.email?.trim() ||
      d.userId.slice(0, 8)
    );
  }, [drivers, driverId]);

  function requestSave() {
    if (!driverId) {
      toast({
        title: "Select a driver",
        description: "Choose a team member with a Driver role.",
        variant: "destructive",
      });
      return;
    }
    if (selected.size === 0) {
      toast({
        title: "Select sales orders",
        description:
          "Pick at least one order with fulfillment New or Rescheduled.",
        variant: "destructive",
      });
      return;
    }

    if (!deliveryDate.trim()) {
      toast({
        title: "Delivery date required",
        description: "Choose the scheduled delivery date for this run.",
        variant: "destructive",
      });
      return;
    }

    setSaveConfirmOpen(true);
  }

  async function performSave() {
    try {
      setSaving(true);
      const id = await createDelivery({
        driverUserId: driverId,
        salesOrderIds: [...selected],
        notes: notes.trim() || null,
        deliveryDate: deliveryDate.trim(),
      });
      toast({
        title: "Delivery saved",
        description: "Sales orders are now marked delivery note created.",
      });
      router.push(`/app/delivery-notes/${id}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Could not save delivery",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const orderColumns = useMemo<ColumnDef<SalesOrderPickRow>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        header: () => (
          <div className={orderCheckboxWrapClass}>
            <Checkbox
              className="size-4 shrink-0 p-0"
              checked={
                allSelected ? true : someSelected ? "indeterminate" : false
              }
              onCheckedChange={(c) => toggleAll(c === true)}
              aria-label="Select all eligible sales orders"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className={orderCheckboxWrapClass}>
            <Checkbox
              checked={selected.has(row.original.id)}
              onCheckedChange={(c) => toggle(row.original.id, c === true)}
              aria-label={`Select ${row.original.number}`}
            />
          </div>
        ),
        meta: {
          stopRowClick: true,
          thClassName: "w-12 max-w-[3rem] px-3 text-center",
          tdClassName: cn(tableCellClass, "w-12 max-w-[3rem] px-3 text-center"),
        },
      },
      {
        id: "number",
        accessorFn: (r) => r.number,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order" />
        ),
        cell: ({ row }) => (
          <Link
            href={`/app/sales-orders/${row.original.id}`}
            className={cellLinkClass}
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.number}
          </Link>
        ),
        meta: { tdClassName: cn(tableCellClass, "whitespace-nowrap") },
      },
      {
        id: "deliveryDate",
        accessorFn: (r) => r.deliveryDate ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Delivery date" />
        ),
        cell: ({ row }) => (
          <span className="font-bold tabular-nums">
            {fmtSoDeliveryDate(row.original.deliveryDate)}
          </span>
        ),
        meta: { tdClassName: cn(tableCellClass, "whitespace-nowrap") },
      },
      {
        id: "fulfillment",
        accessorFn: (r) => SALES_ORDER_FULFILLMENT_LABELS[r.fulfillmentStatus],
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Fulfillment" />
        ),
        cell: ({ row }) => (
          <SalesOrderFulfillmentStatusBadge status={row.original.fulfillmentStatus} />
        ),
        meta: { tdClassName: cn(tableCellClass, "whitespace-nowrap") },
      },
      {
        id: "customer",
        accessorFn: (r) => r.clientName,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        cell: ({ row }) => {
          const o = row.original;
          if (!o.clientName) return "—";
          if (o.customerId) {
            return (
              <Link
                href={`/app/customers/${o.customerId}/edit`}
                className={cellLinkClass}
                onClick={(e) => e.stopPropagation()}
              >
                {o.clientName}
              </Link>
            );
          }
          return <span className="font-medium">{o.clientName}</span>;
        },
        meta: { tdClassName: tableCellClass },
      },
      {
        id: "phone",
        accessorFn: (r) => r.phone,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Phone" />
        ),
        cell: ({ row }) =>
          row.original.phone ? (
            <a
              href={`tel:${row.original.phone.replace(/\s/g, "")}`}
              className={cellLinkClass}
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.phone}
            </a>
          ) : (
            "—"
          ),
        meta: { tdClassName: tableCellClass },
      },
      {
        id: "city",
        accessorFn: (r) => r.city,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="City" />
        ),
        cell: ({ row }) => row.original.city || "—",
        meta: {
          tdClassName: cn(
            tableCellClass,
            "max-w-[180px] text-muted-foreground whitespace-normal break-words",
          ),
        },
      },
      {
        id: "items",
        accessorFn: (r) =>
          r.items.map((it) => `${it.item} ${it.quantity}`).join(" "),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Items & qty" />
        ),
        cell: ({ row }) => {
          const o = row.original;
          if (o.items.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <ul className="space-y-1.5 text-sm list-none m-0 p-0">
              {o.items.map((it, idx) => (
                <li
                  key={`${o.id}-${idx}`}
                  className="border-b border-border/60 pb-1.5 last:border-0 last:pb-0"
                >
                  {it.product_id ? (
                    <Link
                      href={`/app/products/${it.product_id}/edit`}
                      className={cn(cellLinkClass, "leading-snug")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {it.item}
                    </Link>
                  ) : (
                    <span className="font-medium leading-snug">{it.item}</span>
                  )}
                  {it.description ? (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {it.description}
                    </div>
                  ) : null}
                  <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-muted-foreground">
                    <span>
                      Qty{" "}
                      <span className="tabular-nums text-foreground font-medium">
                        {it.quantity}
                      </span>
                      {it.tax_percent ? (
                        <span className="ml-1">· Tax {it.tax_percent}%</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {fmtMoney(lineTotal(it), o.currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          );
        },
        meta: { tdClassName: cn(tableCellClass, "min-w-[200px] py-2") },
      },
      {
        id: "payment",
        accessorFn: (r) => SALES_ORDER_PAYMENT_LABELS[r.paymentStatus],
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Payment" />
        ),
        cell: ({ row }) => (
          <SalesOrderPaymentStatusBadge status={row.original.paymentStatus} />
        ),
        meta: { tdClassName: tableCellClass },
      },
      {
        id: "total",
        accessorFn: (r) => r.total,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order total" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold">
            {fmtMoney(row.original.total, row.original.currency, 0)}
          </span>
        ),
        meta: { tdClassName: cn(tableCellClass, "text-right") },
      },
    ],
    [allSelected, someSelected, selected],
  );

  const ordersSortTable = useReactTable({
    data: searchFilteredOrders,
    columns: orderColumns,
    state: { sorting: ordersSorting },
    onSortingChange: setOrdersSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedSearchFilteredOrders = ordersSortTable
    .getRowModel()
    .rows.map((row) => row.original);

  const paginatedVisibleOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersPageSize;
    return sortedSearchFilteredOrders.slice(start, start + ordersPageSize);
  }, [sortedSearchFilteredOrders, ordersPage, ordersPageSize]);

  const ordersTotal = sortedSearchFilteredOrders.length;

  const renderOrdersEmpty = () => {
    if (loading) {
      return (
        <div className={ordersEmptyStateClass}>
          <InlineTableRowsSkeleton rowCount={6} className="w-full max-w-md mx-auto" />
        </div>
      );
    }
    if (orders.length === 0) {
      return (
        <div className={ordersEmptyStateClass}>
          No eligible sales orders. Orders must be active with fulfillment New
          or Rescheduled (for example, not Pending and not already on a delivery
          note).
        </div>
      );
    }
    if (zoneLoading && driverId.trim() && resolvedZoneFilter === undefined) {
      return (
        <div className={ordersEmptyStateClass}>
          Applying this driver’s route…
        </div>
      );
    }
    if (searchFilteredOrders.length === 0) {
      return (
        <div className={ordersEmptyStateClass}>
          {ordersDebouncedSearch ? (
            <>No sales orders match your search.</>
          ) : orders.length > 0 && dateFilteredOrders.length === 0 ? (
            <>
              No sales orders match this delivery date. Change the date, or clear or
              align delivery dates on sales orders — orders without a delivery date
              always appear here.
            </>
          ) : driverId.trim() &&
            resolvedZoneFilter?.hasZoneAssignment &&
            resolvedZoneFilter.cityIds.length === 0 &&
            resolvedZoneFilter.cityNamesLower.length === 0 ? (
            "This driver’s zone has no cities — link cities in Zone Cities to see orders."
          ) : driverId.trim() && resolvedZoneFilter?.hasZoneAssignment ? (
            "No eligible sales orders for this driver’s route. Try another driver or add the delivery city to the zone."
          ) : (
            "No eligible sales orders match the current filters."
          )}
        </div>
      );
    }
    return null;
  };

  const ordersEmpty = renderOrdersEmpty();

  const ordersTableContent = ordersEmpty ? (
    ordersEmpty
  ) : (
    <DataTable
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
      tableContainerClassName="min-h-0 flex-1 overflow-auto"
      variant="minimal"
      columns={orderColumns}
      data={paginatedVisibleOrders}
      manualFiltering
      manualSorting
      sorting={ordersSorting}
      onSortingChange={setOrdersSorting}
      hideSearch
      getRowId={(r) => r.id}
      emptyMessage="No orders on this page."
      footer={
        ordersTotal > 0 ? (
          <DataTablePaginationFooter
            variant="minimal"
            total={ordersTotal}
            page={ordersPage}
            pageSize={ordersPageSize}
            onPageChange={setOrdersPage}
            onPageSizeChange={(size) => {
              setOrdersPageSize(size);
              setOrdersPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        ) : null
      }
    />
  );

  if (loading) {
    return (
      <AppPageShell
        fillHeight
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={
          <Button variant="ghost" size="icon" asChild aria-label="Back to delivery notes">
            <Link href="/app/delivery-notes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <div className={deliveryFormGridClass}>
            <FormTwoColumnPageSkeleton withLineItems />
          </div>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to delivery notes">
          <Link href="/app/delivery-notes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <Button
          type="button"
          onClick={requestSave}
          disabled={saving}
          className="gap-2 rounded font-semibold shadow-sm"
        >
          <Save className="size-3.5 shrink-0" aria-hidden />
          {saving ? "Saving…" : "Save delivery"}
        </Button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <div className={deliveryFormGridClass}>
          <SectionCard icon={Truck} title="Delivery details" className="self-start">
            <div className="space-y-2">
              <Label className={fieldLabelClass}>Driver</Label>
              {drivers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active team members with &quot;driver&quot; in the role name. Add
                  or rename a role in{" "}
                  <Link href="/app/settings?tab=roles" className="underline">
                    Company settings → Roles
                  </Link>{" "}
                  and assign it on{" "}
                  <Link href="/app/company-team" className="underline">
                    Company team
                  </Link>
                  .
                </p>
              ) : (
                <div className="flex min-w-0 items-center gap-1.5">
                  <Select value={driverId} onValueChange={setDriverId}>
                    <SelectTrigger className="h-8 w-full min-w-0 rounded-sm text-xs">
                      <SelectValue placeholder="Choose driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((d) => (
                        <SelectItem key={d.userId} value={d.userId}>
                          {d.profile?.full_name?.trim() ||
                            d.profile?.email?.trim() ||
                            d.userId.slice(0, 8)}{" "}
                          <span className="text-muted-foreground">
                            ({d.roleName})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showDriverRouteInfo ? (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Cities on this driver’s route"
                          >
                            <Info className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          align="start"
                          className="max-w-[14rem] text-left"
                        >
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-background/70">
                            Route cities
                          </p>
                          {driverRouteCities.length > 0 ? (
                            <ul className="m-0 list-inside list-disc space-y-0.5 p-0 text-xs leading-snug">
                              {driverRouteCities.map((city) => (
                                <li key={city}>{city}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs leading-snug">
                              No cities linked to this zone. Add cities under Zone
                              Cities to filter orders by route.
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="del-delivery-date" className={fieldLabelClass}>
                Delivery date
              </Label>
              <Input
                id="del-delivery-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="rounded-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="del-notes" className={fieldLabelClass}>
                Notes (optional)
              </Label>
              <Textarea
                id="del-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="min-h-[80px] resize-y rounded-sm py-2"
                placeholder="Vehicle, route, or handoff notes…"
              />
            </div>

            {selectedList.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {selectedList.length} order
                {selectedList.length === 1 ? "" : "s"} selected.
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            icon={ListOrdered}
            title="Sales orders"
            className="min-h-[min(70vh,32rem)] lg:min-h-0"
            headerRight={
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                {!ordersEmpty && visibleOrders.length > 0 ? (
                  <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                    {ordersTotal} of {visibleOrders.length}
                  </span>
                ) : null}
                <div className="relative w-full min-w-[12rem] sm:min-w-[16rem] sm:w-64 lg:w-72">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={ordersSearchQuery}
                    onChange={(e) => setOrdersSearchQuery(e.target.value)}
                    placeholder="Order, customer, phone…"
                    className={ordersSearchInputClass}
                    aria-label="Search sales orders by order number, customer, or phone"
                    autoComplete="off"
                  />
                </div>
              </div>
            }
          >
            <div className="flex min-h-0 flex-1 flex-col gap-0 -mx-4 -mb-5 px-0 pb-0">
              {ordersTableContent}
            </div>
          </SectionCard>
        </div>
      </div>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save delivery note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a delivery for {selectedDriverLabel} on{" "}
              {deliveryDate.trim() || "the selected date"} with{" "}
              {selected.size} sales order{selected.size === 1 ? "" : "s"}. Linked
              orders will be marked delivery note created. You will be taken to
              the delivery detail page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                setSaveConfirmOpen(false);
                void performSave();
              }}
            >
              {saving ? "Saving…" : "Save delivery"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
