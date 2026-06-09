"use client";
import { TableBodyRowsSkeleton, InlineTableRowsSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Coins, Truck, Search, History, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  listDriverCredits,
  listDriverSettlements,
  createDriverSettlement,
  type DriverCreditSettlement,
  type DriverCreditWithDriver,
} from "@/lib/driver-credits-service";
import { AppPageShell } from "@/components/app-page-shell";
import { DeliveryDriverSettlementBadge } from "@/components/delivery-driver-balance-status-badge";

function driverDisplayName(row: DriverCreditWithDriver): string {
  return row.driver?.full_name?.trim() || "(Unknown driver)";
}

export default function DriverCreditPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [credits, setCredits] = useState<DriverCreditWithDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [settleFor, setSettleFor] = useState<DriverCreditWithDriver | null>(
    null,
  );
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleNotes, setSettleNotes] = useState<string>("");
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [historyFor, setHistoryFor] = useState<DriverCreditWithDriver | null>(
    null,
  );
  const [history, setHistory] = useState<DriverCreditSettlement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await listDriverCredits();
        if (!cancelled) setCredits(rows);
      } catch (e: unknown) {
        if (!cancelled) {
          const err = e as { message?: string };
          toast({
            title: "Failed to load driver balance",
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return credits;
    return credits.filter((row) => {
      const name = driverDisplayName(row);
      const email = row.driver?.email || "";
      const phone = row.driver?.phone || "";
      return (
        name.toLowerCase().includes(term) ||
        email.toLowerCase().includes(term) ||
        phone.toLowerCase().includes(term)
      );
    });
  }, [credits, search]);

  const totalDue = useMemo(
    () =>
      filtered.reduce(
        (sum, r) => sum + Number(r.amountDue ?? r.balance ?? 0),
        0,
      ),
    [filtered],
  );

  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <AppPageShell
      leading={
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/40">
          <Coins className="h-5 w-5 text-amber-600" />
        </div>
      }
      subtitle="When drivers over-collect on delivery, store the difference here and apply it to their next settlement or refund it."
    >
      {!loading && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Due</p>
              <p className="mt-1 text-xl font-bold text-red-700">
                MUR {fmtMoney(totalDue)}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {filtered.filter((r) => r.settlementStatus === "due").length} driver
              {filtered.filter((r) => r.settlementStatus === "due").length === 1
                ? ""
                : "s"}{" "}
              with outstanding balance
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Driver Balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by driver name, email or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Driver</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Phone</th>
                    <th className="text-left p-3">Settlement</th>
                    <th className="text-right p-3">Amount Due</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <TableBodyRowsSkeleton rowCount={5} colCount={6} />
                </tbody>
              </table>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-3">
              <Truck className="h-10 w-10" />
              <div className="space-y-1">
                <p className="font-medium">No driver balance yet</p>
                <p className="text-sm">
                  Credit appears here when drivers over-collect on a delivery.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Driver</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Phone</th>
                    <th className="text-left p-3">Settlement</th>
                    <th className="text-right p-3">Amount Due</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const name = driverDisplayName(row);
                    const balance = Number(row.balance || 0);
                    const isDue = row.settlementStatus === "due";
                    const amountDue = row.amountDue ?? balance;
                    return (
                      <tr
                        key={`${row.user_id}-${row.driver_user_id}`}
                        className="border-t"
                      >
                        <td className="p-3">
                          {row.membership_id ? (
                            <button
                              type="button"
                              className="text-left hover:underline"
                              onClick={() =>
                                router.push(
                                  `/app/company-team/${row.membership_id}`,
                                )
                              }
                            >
                              {name}
                            </button>
                          ) : (
                            <span>{name}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {row.driver?.email || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {row.driver?.phone || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <DeliveryDriverSettlementBadge
                            status={isDue ? "due" : "settled"}
                          />
                        </td>
                        <td className="p-3 text-right font-semibold tabular-nums">
                          {isDue ? (
                            <span className="text-red-700">
                              MUR {fmtMoney(amountDue)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!isDue || balance <= 0}
                            onClick={() => {
                              setSettleFor(row);
                              setSettleAmount(balance);
                              setSettleNotes("");
                              setSettleError(null);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Settle
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              setHistoryFor(row);
                              setHistory([]);
                              setHistoryLoading(true);
                              try {
                                const rows = await listDriverSettlements(
                                  row.driver_user_id,
                                );
                                setHistory(rows);
                              } catch (e: unknown) {
                                const err = e as { message?: string };
                                toast({
                                  title: "Failed to load settlement history",
                                  description:
                                    err?.message ?? "Please try again.",
                                  variant: "destructive",
                                });
                              } finally {
                                setHistoryLoading(false);
                              }
                            }}
                          >
                            <History className="h-4 w-4 mr-1" />
                            History
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!settleFor} onOpenChange={() => setSettleFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Driver Balance</DialogTitle>
            <DialogDescription>
              Record a payment against this driver&apos;s balance. Partial
              payments are allowed — the remaining amount stays due until fully
              settled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Driver</p>
              <p className="text-sm font-medium">
                {settleFor ? driverDisplayName(settleFor) : "(Unknown driver)"}
              </p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Amount due</span>
              <span className="font-semibold text-red-700">
                MUR {fmtMoney(Number(settleFor?.balance || 0))}
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-settle-amount">Settlement amount</Label>
              <Input
                id="driver-settle-amount"
                type="number"
                min={0}
                step="0.01"
                value={settleAmount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSettleAmount(val >= 0 ? val : 0);
                  if (settleError) setSettleError(null);
                }}
                className={settleError ? "border-destructive" : ""}
              />
              {settleError ? (
                <p className="text-xs text-destructive">{settleError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Enter any amount up to the outstanding balance. Linked
                  delivery notes move to Settled when their due is cleared.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-settle-notes">Notes (optional)</Label>
              <Input
                id="driver-settle-notes"
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
                placeholder="e.g. Refunded to driver in cash"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSettleFor(null)}
              disabled={settling}
            >
              Cancel
            </Button>
            <Button
              disabled={settling || !settleFor}
              onClick={async () => {
                if (!settleFor) return;
                const available = Number(settleFor.balance || 0);
                if (settleAmount <= 0) {
                  setSettleError("Amount must be greater than zero.");
                  return;
                }
                if (settleAmount > available) {
                  setSettleError(
                    "Amount cannot be greater than the outstanding balance.",
                  );
                  return;
                }
                try {
                  setSettling(true);
                  await createDriverSettlement({
                    driverUserId: settleFor.driver_user_id,
                    amount: settleAmount,
                    notes: settleNotes.trim() || null,
                  });
                  const remaining = Math.max(0, available - settleAmount);
                  toast({
                    title: "Settlement recorded",
                    description:
                      remaining > 0
                        ? `MUR ${fmtMoney(settleAmount)} applied. MUR ${fmtMoney(remaining)} remains due.`
                        : "Driver balance fully settled. Linked delivery notes updated.",
                  });
                  setLoading(true);
                  const rows = await listDriverCredits();
                  setCredits(rows);
                  setSettleFor(null);
                } catch (e: unknown) {
                  const err = e as { message?: string };
                  toast({
                    title: "Failed to record settlement",
                    description: err?.message ?? "Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setSettling(false);
                  setLoading(false);
                }
              }}
            >
              {settling ? "Settling..." : "Settle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={() => setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Settlement History</DialogTitle>
            <DialogDescription>
              All settlements recorded for this driver&apos;s balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Driver</p>
              <p className="text-sm font-medium">
                {historyFor ? driverDisplayName(historyFor) : "(Unknown driver)"}
              </p>
            </div>
            {historyLoading ? (
              <InlineTableRowsSkeleton rowCount={4} />
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No settlements recorded yet for this driver.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded border">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-left p-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const fromDelivery = !!h.delivery_id;
                      return (
                        <tr key={h.id} className="border-t">
                          <td className="p-2">
                            {new Date(h.created_at).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-2 text-right">
                            <div
                              className={`flex flex-col items-end gap-1 font-semibold ${
                                fromDelivery ? "text-emerald-700" : "text-red-600"
                              }`}
                            >
                              <span>MUR {fmtMoney(h.amount)}</span>
                              {fromDelivery ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                  Due from delivery
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                  Manual settlement
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            {h.notes ? (
                              fromDelivery && h.delivery_id ? (
                                <span className="text-xs sm:text-sm text-muted-foreground">
                                  {h.notes}{" "}
                                  <Link
                                    href={`/app/delivery-notes/${h.delivery_id}`}
                                    className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                                  >
                                    View delivery
                                  </Link>
                                </span>
                              ) : (
                                <span>{h.notes}</span>
                              )
                            ) : fromDelivery && h.delivery_id ? (
                              <Link
                                href={`/app/delivery-notes/${h.delivery_id}`}
                                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                              >
                                View delivery
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryFor(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
