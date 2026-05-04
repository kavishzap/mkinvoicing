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
      <div className="w-full space-y-6">
        <Card>
          <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-3">
            <CardTitle className="text-base">Summary</CardTitle>
            <DeliveryNoteStatusBadge status={delivery.status} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="delivery-note-status" className="text-muted-foreground">
                Delivery note status
              </Label>
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
                  Moving to <span className="font-medium text-foreground">Delivered to driver</span>{" "}
                  updates every sales order on this delivery to the same fulfillment status, except
                  orders that are cancelled or already delivered to the customer.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-muted-foreground">Driver</span>
              <span className="font-medium">{delivery.driverDisplay}</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-muted-foreground">Created by</span>
              <span>{delivery.createdByDisplay}</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-muted-foreground">Orders</span>
              <span>{delivery.salesOrders.length}</span>
            </div>
            {delivery.notes ? (
              <div className="pt-2">
                <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">
                  Notes
                </span>
                <p className="whitespace-pre-wrap">{delivery.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {delivery.salesOrders.map((so) => (
          <Card key={so.linkId}>
            <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{so.number}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {so.clientName}
                  {so.phone ? ` · ${so.phone}` : ""}
                </p>
                {so.email ? (
                  <p className="text-sm text-muted-foreground">{so.email}</p>
                ) : null}
                {so.addressLines ? (
                  <p className="text-sm mt-1">{so.addressLines}</p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular-nums">
                  {fmtMoney(so.total, so.currency)}
                </span>
                <SalesOrderFulfillmentStatusBadge status={so.fulfillmentStatus} />
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Line items
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Tax %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(so.items ?? []).map((it, idx) => (
                      <TableRow key={`${so.salesOrderId}-${idx}`}>
                        <TableCell>
                          <div className="font-medium">{it.item}</div>
                          {it.description ? (
                            <div className="text-xs text-muted-foreground">
                              {it.description}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtMoney(it.unit_price, so.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.tax_percent}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppPageShell>
  );
}
