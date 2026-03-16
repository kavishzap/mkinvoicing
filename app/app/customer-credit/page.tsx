"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Coins, Users, Search, History, CheckCircle2 } from "lucide-react";
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
  listCustomerCredits,
  listCustomerSettlements,
  createCustomerSettlement,
  type CustomerCreditSettlement,
  type CustomerCreditWithCustomer,
} from "@/lib/customer-credits-service";

export default function CustomerCreditPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [credits, setCredits] = useState<CustomerCreditWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [settleFor, setSettleFor] =
    useState<CustomerCreditWithCustomer | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleNotes, setSettleNotes] = useState<string>("");
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [historyFor, setHistoryFor] =
    useState<CustomerCreditWithCustomer | null>(null);
  const [history, setHistory] = useState<CustomerCreditSettlement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await listCustomerCredits();
        if (!cancelled) setCredits(rows);
      } catch (e: any) {
        if (!cancelled) {
          toast({
            title: "Failed to load customer credit",
            description: e?.message ?? "Please try again.",
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
      const c = row.customer;
      const name =
        c?.company_name ||
        c?.full_name ||
        "";
      const email = c?.email || "";
      const phone = c?.phone || "";
      return (
        name.toLowerCase().includes(term) ||
        email.toLowerCase().includes(term) ||
        phone.toLowerCase().includes(term)
      );
    });
  }, [credits, search]);

  const totalBalance = useMemo(
    () => filtered.reduce((sum, r) => sum + Number(r.balance || 0), 0),
    [filtered]
  );

  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center">
            <Coins className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Customer Credit
            </h1>
            <p className="text-muted-foreground mt-1">
              Overview of overpayments stored as credit per customer
            </p>
          </div>
        </div>
      </div>

      {!loading && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Credit</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                MUR {fmtMoney(totalBalance)}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {filtered.length} customer
              {filtered.length === 1 ? "" : "s"} with credit
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Customer Credit Balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, email or phone..."
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
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Phone</th>
                    <th className="text-right p-3">Credit Balance</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-3">
                        <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                      </td>
                      <td className="p-3">
                        <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                      </td>
                      <td className="p-3">
                        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                      </td>
                      <td className="p-3 text-right">
                        <div className="h-4 w-20 rounded bg-muted animate-pulse ml-auto" />
                      </td>
                      <td className="p-3 text-right">
                        <div className="h-8 w-28 rounded bg-muted animate-pulse ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-3">
              <Users className="h-10 w-10" />
              <div className="space-y-1">
                <p className="font-medium">No customer credit yet</p>
                <p className="text-sm">
                  Credit appears here when invoices are overpaid for a customer.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Phone</th>
                    <th className="text-right p-3">Credit Balance</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const c = row.customer;
                    const name =
                      c?.company_name ||
                      c?.full_name ||
                      "(Unknown customer)";
                    const balance = Number(row.balance || 0);
                    return (
                      <tr
                        key={`${row.user_id}-${row.customer_id}`}
                        className="border-t"
                      >
                        <td className="p-3">
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() =>
                              router.push(`/app/customers?focus=${row.customer_id}`)
                            }
                          >
                            {name}
                          </button>
                        </td>
                        <td className="p-3">
                          {c?.email || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {c?.phone || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-semibold text-emerald-700">
                          MUR {fmtMoney(balance)}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={balance <= 0}
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
                                const rows = await listCustomerSettlements(
                                  row.customer_id
                                );
                                setHistory(rows);
                              } catch (e: any) {
                                toast({
                                  title: "Failed to load settlement history",
                                  description:
                                    e?.message ?? "Please try again.",
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
      {/* Settle dialog */}
      <Dialog open={!!settleFor} onOpenChange={() => setSettleFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Customer Credit</DialogTitle>
            <DialogDescription>
              Apply available credit for this customer. The balance will be
              reduced by the settled amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="text-sm font-medium">
                {settleFor?.customer?.company_name ||
                  settleFor?.customer?.full_name ||
                  "(Unknown customer)"}
              </p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available credit</span>
              <span className="font-semibold text-emerald-700">
                MUR {fmtMoney(Number(settleFor?.balance || 0))}
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settle-amount">Settlement amount</Label>
              <Input
                id="settle-amount"
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
                  Cannot exceed the available credit.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="settle-notes">Notes (optional)</Label>
              <Input
                id="settle-notes"
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
                placeholder="e.g. Applied to invoice INV-001"
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
                    "Amount cannot be greater than the available credit."
                  );
                  return;
                }
                try {
                  setSettling(true);
                  await createCustomerSettlement({
                    customerId: settleFor.customer_id,
                    amount: settleAmount,
                    notes: settleNotes.trim() || null,
                  });
                  toast({
                    title: "Settlement recorded",
                    description:
                      "Customer credit has been reduced by the settled amount.",
                  });
                  // Reload balances
                  setLoading(true);
                  const rows = await listCustomerCredits();
                  setCredits(rows);
                  setSettleFor(null);
                } catch (e: any) {
                  toast({
                    title: "Failed to record settlement",
                    description: e?.message ?? "Please try again.",
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

      {/* Settlement history dialog */}
      <Dialog open={!!historyFor} onOpenChange={() => setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Settlement History</DialogTitle>
            <DialogDescription>
              All settlements recorded for this customer&apos;s credit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="text-sm font-medium">
                {historyFor?.customer?.company_name ||
                  historyFor?.customer?.full_name ||
                  "(Unknown customer)"}
              </p>
            </div>
            {historyLoading ? (
              <div className="space-y-2">
                <div className="h-5 w-full rounded bg-muted animate-pulse" />
                <div className="h-5 w-full rounded bg-muted animate-pulse" />
                <div className="h-5 w-full rounded bg-muted animate-pulse" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No settlements recorded yet for this customer.
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
                      const fromInvoice = !!h.invoice_id;
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
                                fromInvoice ? "text-emerald-700" : "text-red-600"
                              }`}
                            >
                              <span>MUR {fmtMoney(h.amount)}</span>
                              {fromInvoice ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                  From invoice
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
                              h.notes ===
                                "Applied automatically when updating invoice payment." &&
                              fromInvoice &&
                              h.invoice_id ? (
                                <span className="text-xs sm:text-sm text-muted-foreground">
                                  Applied automatically when updating{" "}
                                  <Link
                                    href={`/app/invoices/${h.invoice_id}`}
                                    className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                                  >
                                    invoice
                                  </Link>{" "}
                                  payment.
                                </span>
                              ) : (
                                <span>{h.notes}</span>
                              )
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
    </div>
  );
}

