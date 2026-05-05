"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { DeliveryNoteStatusBadge } from "@/components/delivery-note-status-badge";
import { DeliveryNoteViewActions } from "@/components/delivery-note-view-actions";
import {
  advanceDeliveryNoteStatus,
  DELIVERY_NOTE_STATUSES,
  DELIVERY_NOTE_STATUS_LABELS,
  getDelivery,
  getNextDeliveryNoteStatus,
  type DeliveryDetail,
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

export default function DeliveryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const d = await getDelivery(id);
        if (cancelled) return;
        setDelivery(d);
        if (!d) {
          toast({
            title: "Not found",
            description: "This delivery does not exist or you cannot access it.",
            variant: "destructive",
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const err = e as { message?: string };
          toast({
            title: "Failed to load delivery",
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
  }, [id, toast]);

  if (loading) {
    return (
      <AppPageShell className="max-w-[1800px]" subtitle="Loading…">
        <div className="h-40 w-full rounded-lg bg-muted animate-pulse" />
      </AppPageShell>
    );
  }

  if (!delivery) {
    return (
      <AppPageShell subtitle="Delivery not found.">
        <Button asChild variant="outline">
          <Link href="/app/delivery-notes">Back to deliveries</Link>
        </Button>
      </AppPageShell>
    );
  }

  const nextStatus = getNextDeliveryNoteStatus(delivery.status);
  const statusIdx = DELIVERY_NOTE_STATUSES.indexOf(delivery.status);

  return (
    <AppPageShell
      className="max-w-[1800px]"
      leading={
        <Button variant="ghost" size="icon" asChild aria-label="Back to delivery notes">
          <Link href="/app/delivery-notes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      subtitle={`Created ${fmtWhen(delivery.createdAt)} · Driver ${delivery.driverDisplay}`}
      belowSubtitle={
        <div className="print:hidden">
          <DeliveryNoteViewActions deliveryId={id} delivery={delivery} />
        </div>
      }
    >
      <div className="w-full space-y-4">
        <div className="overflow-x-auto rounded-lg border-2 border-primary/40 bg-primary/5 shadow-sm">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <tbody>
              <tr className="bg-primary/15">
                <th className="border px-3 py-2 text-left font-semibold" colSpan={8}>
                  Delivery Summary
                </th>
              </tr>
              <tr>
                <td className="border px-3 py-2 font-medium">Delivery status</td>
                <td className="border px-3 py-2">
                  <div className="max-w-xs space-y-2">
                    <Select
                      value={delivery.status}
                      disabled={statusBusy || delivery.status === "completed"}
                      onValueChange={async (value) => {
                        const target = value as DeliveryNoteStatus;
                        if (target === delivery.status) return;
                        const allowedNext = getNextDeliveryNoteStatus(delivery.status);
                        if (allowedNext !== target) {
                          toast({
                            title: "One step at a time",
                            description:
                              "Choose the next status in order (you cannot skip from New to Completed).",
                            variant: "destructive",
                          });
                          return;
                        }
                        setStatusBusy(true);
                        try {
                          const updated = await advanceDeliveryNoteStatus(delivery.id);
                          if (updated) {
                            setDelivery(updated);
                            const soMsg =
                              target === "delivered_to_driver"
                                ? " All linked sales orders (except cancelled or already delivered to customer) are set to Delivered to driver."
                                : target === "completed"
                                  ? " Linked sales orders on this delivery are set to Delivered to customer where applicable."
                                  : "";
                            toast({
                              title: "Status updated",
                              description: `${DELIVERY_NOTE_STATUS_LABELS[target]}.${soMsg}`,
                            });
                          }
                        } catch (e: unknown) {
                          const err = e as { message?: string };
                          toast({
                            title: "Could not update status",
                            description: err?.message ?? "Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setStatusBusy(false);
                        }
                      }}
                    >
                      <SelectTrigger id="delivery-note-status" size="sm" className="w-full max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_NOTE_STATUSES.map((s) => {
                          const i = DELIVERY_NOTE_STATUSES.indexOf(s);
                          const disabled =
                            delivery.status === "completed"
                              ? s !== "completed"
                              : i < statusIdx || i > statusIdx + 1;
                          return (
                            <SelectItem key={s} value={s} disabled={disabled}>
                              {DELIVERY_NOTE_STATUS_LABELS[s]}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {delivery.status === "new" && nextStatus ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Moving to{" "}
                        <span className="font-medium text-foreground">
                          Delivered to driver
                        </span>{" "}
                        updates every sales order on this delivery to the same
                        fulfillment status, except orders that are cancelled or already
                        delivered to the customer.
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="border px-3 py-2 font-medium">Current</td>
                <td className="border px-3 py-2">
                  <DeliveryNoteStatusBadge status={delivery.status} />
                </td>
                <td className="border px-3 py-2 font-medium">Driver</td>
                <td className="border px-3 py-2">{delivery.driverDisplay}</td>
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
                <td className="border px-3 py-2 font-medium">Delivery ID</td>
                <td className="border px-3 py-2 break-all">{delivery.id}</td>
              </tr>
              <tr>
                <td className="border px-3 py-2 font-medium">Notes</td>
                <td className="border px-3 py-2 whitespace-pre-wrap" colSpan={7}>
                  {delivery.notes?.trim() ? delivery.notes : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full min-w-[1150px] border-collapse text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="border px-3 py-2 text-left font-semibold">SO Number</th>
                <th className="border px-3 py-2 text-left font-semibold">Client</th>
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
                  : [{ item: "—", description: null, quantity: 0, unit_price: 0, tax_percent: 0 }];
                return items.map((it, idx) => (
                  <tr key={`${so.linkId}-${idx}`} className="align-top">
                    {idx === 0 ? (
                      <>
                        <td className="border px-3 py-2 font-medium" rowSpan={items.length}>
                          {so.number}
                        </td>
                        <td className="border px-3 py-2" rowSpan={items.length}>
                          {so.clientName}
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
                      <div className="font-medium">{it.item}</div>
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
  );
}
