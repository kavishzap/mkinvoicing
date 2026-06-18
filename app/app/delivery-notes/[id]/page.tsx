"use client";
import { DetailDocumentPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Pencil, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useToast } from "@/hooks/use-toast";
import { useActionProgress } from "@/contexts/action-progress-context";
import { runActionProgress } from "@/lib/action-progress-bridge";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { DeliveryNoteStatusBadge } from "@/components/delivery-note-status-badge";
import { DeliveryNoteViewActions } from "@/components/delivery-note-view-actions";
import { DeliveryDriverBalancePanel } from "@/components/delivery-driver-balance-panel";
import {
  advanceDeliveryNoteStatus,
  DELIVERY_NOTE_STATUS_LABELS,
  deliveryNoteAllowsEditing,
  getDriverStockReturnContext,
  getNextDeliveryNoteStatus,
  loadDeliveryDetailPageData,
  type DeliveryDetailPageData,
  type DeliveryNoteStatus,
} from "@/lib/deliveries-service";

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

function fmtMoney(n: number, ccy: string | null | undefined) {
  const code = (ccy && String(ccy).trim().length === 3
    ? String(ccy).trim().toUpperCase()
    : "MUR") as string;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  }
}

function DeliveryDetailSkeleton() {
  return (
    <div className="w-full space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
      <DetailDocumentPageSkeleton />
      <DetailDocumentPageSkeleton />
    </div>
  );
}

export default function DeliveryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<DeliveryDetailPageData | null>(null);
  const { isRunning } = useActionProgress();
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<DeliveryNoteStatus | null>(
    null,
  );
  const [transferStock, setTransferStock] = useState(true);

  const reloadPageData = useCallback(async () => {
    if (!id) return null;
    const data = await loadDeliveryDetailPageData(id);
    setPageData(data);
    return data;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await loadDeliveryDetailPageData(id);
        if (cancelled) return;
        setPageData(data);
        if (!data) {
          toast({
            title: "Not found",
            description: "This delivery does not exist or you cannot access it.",
            variant: "destructive",
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Failed to load delivery",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
          setPageData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  const backButton = (
    <Button variant="ghost" size="icon" asChild aria-label="Back to delivery notes">
      <Link href="/app/delivery-notes">
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <AppPageShell
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={backButton}
      >
        <DeliveryDetailSkeleton />
      </AppPageShell>
    );
  }

  const delivery = pageData?.delivery;

  if (!delivery) {
    return (
      <AppPageShell
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={backButton}
      >
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <p className="text-sm text-muted-foreground">Delivery not found.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/app/delivery-notes">Back to delivery notes</Link>
          </Button>
        </div>
      </AppPageShell>
    );
  }

  const nextStatus = getNextDeliveryNoteStatus(delivery.status);

  const openStatusConfirm = (target: DeliveryNoteStatus) => {
    setPendingStatus(target);
    if (target === "delivered_to_driver") {
      setTransferStock(true);
    }
    setStatusConfirmOpen(true);
  };

  const applyStatusAdvance = async (
    target: DeliveryNoteStatus,
    opts?: { transferStock?: boolean },
  ) => {
    const progressMessage =
      target === "delivered_to_driver"
        ? "Marking delivery as delivered to driver…"
        : target === "completed"
          ? "Marking delivery as completed…"
          : "Updating delivery status…";
    await runActionProgress(progressMessage, async () => {
      try {
        const updated = await advanceDeliveryNoteStatus(delivery.id, {
          transferStock: opts?.transferStock,
        });
        if (updated) {
          const stockReturn =
            updated.driverSettlementStatus !== "pending"
              ? null
              : await getDriverStockReturnContext(updated.id, {
                  p_days: 0,
                  delivery: updated,
                });
          setPageData((prev) =>
            prev
              ? {
                  delivery: updated,
                  drivers: prev.drivers,
                  stockReturn,
                }
              : null,
          );
          const soMsg =
            target === "delivered_to_driver"
              ? opts?.transferStock === false
                ? " Linked sales orders were updated. No stock was transferred."
                : " Stock was moved to the driver location and linked sales orders were updated."
              : target === "completed"
                ? " Linked sales orders were set to delivered to customer where applicable."
                : "";
          toast({
            title: "Status updated",
            description: `${DELIVERY_NOTE_STATUS_LABELS[target]}.${soMsg}`,
          });
        }
      } catch (e: unknown) {
        toast({
          title: "Could not update status",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <>
      <AppPageShell
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={backButton}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
            {deliveryNoteAllowsEditing(delivery.status) ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-2 rounded font-semibold shadow-sm"
              >
                <Link href={`/app/delivery-notes/${id}/edit`}>
                  <Pencil className="size-3.5 shrink-0" aria-hidden />
                  Edit
                </Link>
              </Button>
            ) : null}
            {nextStatus === "delivered_to_driver" ? (
              <Button
                type="button"
                onClick={() => openStatusConfirm("delivered_to_driver")}
                disabled={isRunning || statusConfirmOpen}
                className="gap-2 rounded font-semibold shadow-sm"
              >
                <Truck className="size-3.5 shrink-0" aria-hidden />
                Delivered to Driver
              </Button>
            ) : null}
            {nextStatus === "completed" ? (
              <Button
                type="button"
                onClick={() => openStatusConfirm("completed")}
                disabled={isRunning || statusConfirmOpen}
                className="gap-2 rounded font-semibold shadow-sm"
              >
                <Check className="size-3.5 shrink-0" aria-hidden />
                Completed
              </Button>
            ) : null}
            <DeliveryNoteViewActions deliveryId={id} delivery={delivery} />
          </div>
        }
      >
        <div className="w-full space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="overflow-x-auto rounded-lg border-2 border-primary/40 bg-primary/5 shadow-sm">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <tbody>
                <tr className="bg-primary/15">
                  <th className="border px-3 py-2 text-left font-semibold" colSpan={6}>
                    Delivery Summary
                  </th>
                </tr>
                <tr>
                  <td className="border px-3 py-2 font-medium">Status</td>
                  <td className="border px-3 py-2">
                    <DeliveryNoteStatusBadge status={delivery.status} />
                  </td>
                  <td className="border px-3 py-2 font-medium">Driver</td>
                  <td className="border px-3 py-2">
                    {delivery.driverMembershipId ? (
                      <Link
                        href={`/app/company-team/${delivery.driverMembershipId}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {delivery.driverDisplay}
                      </Link>
                    ) : (
                      delivery.driverDisplay
                    )}
                  </td>
                  <td className="border px-3 py-2 font-medium">Orders</td>
                  <td className="border px-3 py-2">{delivery.salesOrders.length}</td>
                </tr>
                <tr>
                  <td className="border px-3 py-2 font-medium">Created by</td>
                  <td className="border px-3 py-2">{delivery.createdByDisplay}</td>
                  <td className="border px-3 py-2 font-medium">Created at</td>
                  <td className="border px-3 py-2">{fmtWhen(delivery.createdAt)}</td>
                  <td className="border px-3 py-2 font-medium">Updated at</td>
                  <td className="border px-3 py-2">{fmtWhen(delivery.updatedAt)}</td>
                </tr>
                <tr>
                  <td className="border px-3 py-2 font-medium">Delivery date</td>
                  <td className="border px-3 py-2 tabular-nums" colSpan={5}>
                    {fmtScheduleDay(delivery.deliveryDate)}
                  </td>
                </tr>
                <tr>
                  <td className="border px-3 py-2 font-medium">Notes</td>
                  <td className="border px-3 py-2 whitespace-pre-wrap" colSpan={5}>
                    {delivery.notes?.trim() ? delivery.notes : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <DeliveryDriverBalancePanel
            delivery={delivery}
            drivers={pageData.drivers}
            stockReturn={pageData.stockReturn}
            onDeliveryUpdated={async () => {
              await reloadPageData();
            }}
          />

          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full min-w-[1150px] border-collapse text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="border px-3 py-2 text-left font-semibold">SO Number</th>
                  <th className="border px-3 py-2 text-left font-semibold">Delivery date</th>
                  <th className="border px-3 py-2 text-left font-semibold">Customer</th>
                  <th className="border px-3 py-2 text-left font-semibold">Phone</th>
                  <th className="border px-3 py-2 text-left font-semibold">Address</th>
                  <th className="border px-3 py-2 text-right font-semibold">SO Total</th>
                  <th className="border px-3 py-2 text-left font-semibold">Fulfillment</th>
                  <th className="border px-3 py-2 text-left font-semibold">Item</th>
                  <th className="border px-3 py-2 text-right font-semibold">Qty</th>
                </tr>
              </thead>
              <tbody>
                {delivery.salesOrders.flatMap((so) => {
                  const items = so.items?.length
                    ? so.items
                    : [
                        {
                          product_id: null,
                          item: "—",
                          description: null,
                          quantity: 0,
                          unit_price: 0,
                          tax_percent: 0,
                        },
                      ];
                  return items.map((it, idx) => (
                    <tr key={`${so.linkId}-${idx}`} className="align-top">
                      {idx === 0 ? (
                        <>
                          <td className="border px-3 py-2 font-medium" rowSpan={items.length}>
                            {so.salesOrderId ? (
                              <Link
                                href={`/app/sales-orders/${so.salesOrderId}`}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                {so.number}
                              </Link>
                            ) : (
                              so.number
                            )}
                          </td>
                          <td
                            className="border px-3 py-2 font-bold tabular-nums"
                            rowSpan={items.length}
                          >
                            {fmtScheduleDay(so.deliveryDate)}
                          </td>
                          <td className="border px-3 py-2" rowSpan={items.length}>
                            {so.clientName ? (
                              so.customerId ? (
                                <Link
                                  href={`/app/customers/${so.customerId}/edit`}
                                  className="font-medium text-primary underline-offset-4 hover:underline"
                                >
                                  {so.clientName}
                                </Link>
                              ) : (
                                so.clientName
                              )
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="border px-3 py-2" rowSpan={items.length}>
                            {so.phone || "—"}
                          </td>
                          <td className="border px-3 py-2" rowSpan={items.length}>
                            {so.addressLines || "—"}
                          </td>
                          <td className="border px-3 py-2 text-right tabular-nums" rowSpan={items.length}>
                            {fmtMoney(so.total, so.currency)}
                          </td>
                          <td className="border px-3 py-2" rowSpan={items.length}>
                            <SalesOrderFulfillmentStatusBadge status={so.fulfillmentStatus} />
                          </td>
                        </>
                      ) : null}
                      <td className="border px-3 py-2">
                        {it.product_id ? (
                          <Link
                            href={`/app/products/${it.product_id}/edit`}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {it.item}
                          </Link>
                        ) : (
                          <div className="font-medium">{it.item}</div>
                        )}
                        {it.description ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {it.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="border px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      </AppPageShell>

      <AlertDialog
        open={statusConfirmOpen}
        onOpenChange={(open) => {
          setStatusConfirmOpen(open);
          if (!open) {
            setPendingStatus(null);
            setTransferStock(true);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === "delivered_to_driver"
                ? "Delivered to driver"
                : pendingStatus === "completed"
                  ? "Mark as completed"
                  : "Change delivery status"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {pendingStatus === "delivered_to_driver" ? (
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>
                    Update this delivery to delivered to driver and sync linked
                    sales orders.
                  </p>
                  <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-muted/30 p-3">
                    <div className="space-y-1">
                      <Label
                        htmlFor="transfer-stock"
                        className="text-sm font-medium text-foreground"
                      >
                        Transfer stock
                      </Label>
                      <p className="text-xs leading-relaxed">
                        Move delivery items from the primary warehouse to the
                        driver&apos;s location.
                      </p>
                    </div>
                    <Switch
                      id="transfer-stock"
                      checked={transferStock}
                      onCheckedChange={setTransferStock}
                      disabled={isRunning}
                      aria-label="Transfer stock"
                    />
                  </div>
                </div>
              ) : pendingStatus === "completed" ? (
                <p>
                  Complete this delivery and update linked sales orders to
                  delivered to customer where applicable.
                </p>
              ) : (
                <p>Confirm this status change.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning || !pendingStatus}
              onClick={(e) => {
                e.preventDefault();
                if (!pendingStatus) return;
                const target = pendingStatus;
                const shouldTransferStock = transferStock;
                setStatusConfirmOpen(false);
                setPendingStatus(null);
                setTransferStock(true);
                void applyStatusAdvance(target, {
                  transferStock:
                    target === "delivered_to_driver"
                      ? shouldTransferStock
                      : undefined,
                });
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
