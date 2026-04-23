"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { SalesOrderPaymentStatusBadge } from "@/components/sales-order-payment-status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  createDelivery,
  listDriverTeamMembers,
  listSalesOrdersForDelivery,
  type SalesOrderPickRow,
} from "@/lib/deliveries-service";
import type { TeamMemberRow } from "@/lib/company-team-service";

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

export default function NewDeliveryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<SalesOrderPickRow[]>([]);
  const [drivers, setDrivers] = useState<TeamMemberRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [driverId, setDriverId] = useState<string>("");
  const [notes, setNotes] = useState("");

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

  const selectedList = useMemo(
    () => orders.filter((o) => selected.has(o.id)),
    [orders, selected]
  );

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSave() {
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
        description: "Pick at least one order with fulfillment New.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const id = await createDelivery({
        driverUserId: driverId,
        salesOrderIds: [...selected],
        notes: notes.trim() || null,
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

  return (
    <AppPageShell
      subtitle="Pick active sales orders in New fulfillment and assign a driver from your team."
      actions={
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link href="/app/delivery-notes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <div className="space-y-6 max-w-7xl">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Delivery details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-md">
              <Label>Driver</Label>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading drivers…</p>
              ) : drivers.length === 0 ? (
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
                <Select value={driverId} onValueChange={setDriverId}>
                  <SelectTrigger>
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
              )}
            </div>

            <div className="space-y-2 max-w-xl">
              <Label htmlFor="del-notes">Notes (optional)</Label>
              <Textarea
                id="del-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Vehicle, route, or handoff notes…"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sales orders (New)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-2">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading orders…</div>
            ) : orders.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No eligible sales orders. Orders must be active with fulfillment New
                (for example, not already handed to a driver).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead className="min-w-[260px]">Items & qty</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Order total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(o.id)}
                            onCheckedChange={(c) =>
                              toggle(o.id, c === true)
                            }
                            aria-label={`Select ${o.number}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {o.number}
                        </TableCell>
                        <TableCell>{o.clientName || "—"}</TableCell>
                        <TableCell className="text-sm">{o.phone || "—"}</TableCell>
                        <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                          {o.addressLines || "—"}
                        </TableCell>
                        <TableCell className="align-top py-3">
                          {o.items.length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            <ul className="space-y-2 text-sm list-none m-0 p-0">
                              {o.items.map((it, idx) => (
                                <li
                                  key={`${o.id}-${idx}`}
                                  className="border-b border-border/60 pb-2 last:border-0 last:pb-0"
                                >
                                  <div className="font-medium leading-snug">
                                    {it.item}
                                  </div>
                                  {it.description ? (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {it.description}
                                    </div>
                                  ) : null}
                                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                    <span>
                                      Qty{" "}
                                      <span className="tabular-nums text-foreground font-medium">
                                        {it.quantity}
                                      </span>
                                      {it.tax_percent ? (
                                        <span className="ml-1">
                                          · Tax {it.tax_percent}%
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="tabular-nums text-foreground">
                                      {fmtMoney(lineTotal(it), o.currency)}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <SalesOrderPaymentStatusBadge
                            status={o.paymentStatus}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums align-top font-semibold">
                          {fmtMoney(o.total, o.currency, 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedList.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {selectedList.length} order{selectedList.length === 1 ? "" : "s"}{" "}
            selected.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving…" : "Save delivery"}
          </Button>
          <Button variant="outline" asChild disabled={saving}>
            <Link href="/app/delivery-notes">Cancel</Link>
          </Button>
        </div>
      </div>
    </AppPageShell>
  );
}
