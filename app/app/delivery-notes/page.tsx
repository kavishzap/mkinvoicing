"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Plus, PackageOpen } from "lucide-react";
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
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { DeliveryNoteStatusBadge } from "@/components/delivery-note-status-badge";
import {
  getDelivery,
  listDeliveries,
  setDeliveryDriverStatus,
  type DeliveryListRow,
} from "@/lib/deliveries-service";
import { listTeamMembers, type TeamMemberRow } from "@/lib/company-team-service";
import { addExpense } from "@/lib/expenses-service";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export default function DeliveryNotesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<DeliveryListRow[]>([]);
  const [drivers, setDrivers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverFilter, setDriverFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [createdAtFilter, setCreatedAtFilter] = useState("");
  const [isStoreKeeperModalOpen, setIsStoreKeeperModalOpen] = useState(false);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<Set<string>>(
    new Set()
  );
  const [generatingStoreKeeperList, setGeneratingStoreKeeperList] = useState(false);
  const [driverBalanceRow, setDriverBalanceRow] = useState<DeliveryListRow | null>(null);
  const [confirmingDriverBalance, setConfirmingDriverBalance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [list, team] = await Promise.all([listDeliveries(), listTeamMembers()]);
        if (!cancelled) {
          setRows(list);
          setDrivers(team.filter((m) => m.roleName.toLowerCase().includes("driver")));
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const err = e as { message?: string };
          toast({
            title: "Failed to load deliveries",
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

  const selectedDriverBalanceMember = useMemo(
    () =>
      drivers.find((d) => d.userId === (driverBalanceRow?.driverUserId ?? "")) ??
      null,
    [drivers, driverBalanceRow]
  );
  const selectedDriverRate = Number(selectedDriverBalanceMember?.driverRate ?? 0);
  const selectedDeliveryTotal = Number(driverBalanceRow?.totalAmount ?? 0);
  const amountToReturnOwner = selectedDeliveryTotal - selectedDriverRate;

  async function confirmDriverBalance() {
    if (!driverBalanceRow) return;
    try {
      setConfirmingDriverBalance(true);
      const rate = Number(selectedDriverRate);
      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error("Driver rate is missing or invalid. Set it in Company Team first.");
      }

      await addExpense({
        description: `Driver salary for delivery ${driverBalanceRow.id} (${driverBalanceRow.driverDisplay})`,
        amount: rate,
        currency: "MUR",
        expense_date: new Date().toISOString().slice(0, 10),
        notes: `Delivery total: ${selectedDeliveryTotal}. Amount returned to owner: ${amountToReturnOwner}.`,
        line_items: [
          {
            item: "Driver salary",
            description: `Delivery ${driverBalanceRow.id}`,
            quantity: 1,
            unit_price: rate,
            tax_percent: 0,
            line_total: rate,
          },
        ],
      });

      await setDeliveryDriverStatus(driverBalanceRow.id, true);

      setRows((prev) =>
        prev.map((r) =>
          r.id === driverBalanceRow.id ? { ...r, driverStatus: true } : r
        )
      );
      toast({
        title: "Driver balance recorded",
        description: "Expense saved and driver status marked as completed.",
      });
      setDriverBalanceRow(null);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Could not confirm driver balance",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setConfirmingDriverBalance(false);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const driverOk = r.driverDisplay
        .toLowerCase()
        .includes(driverFilter.trim().toLowerCase());
      const rowDate = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
      const dateOk = dateFilter ? rowDate === dateFilter : true;
      const createdAtText = fmtWhen(r.createdAt).toLowerCase();
      const createdAtOk = createdAtFilter.trim()
        ? createdAtText.includes(createdAtFilter.trim().toLowerCase())
        : true;
      return driverOk && dateOk && createdAtOk;
    });
  }, [rows, driverFilter, dateFilter, createdAtFilter]);

  function toggleDeliverySelection(id: string, checked: boolean) {
    setSelectedDeliveryIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function generateStoreKeeperList() {
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
      const rightX = pageW - margin;
      const generatedAt = new Date().toLocaleString("en-GB");
      const brandColor = "#0F172A";

      doc.setFillColor(brandColor);
      doc.rect(0, 0, pageW, 60, "F");
      doc.setTextColor("#FFFFFF");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("MoLedger", margin, 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Store operations export", margin, 46);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("STORE KEEPER LIST", rightX, 30, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Ref count: ${selectedIds.length}`, rightX, 46, { align: "right" });
      doc.setTextColor("#000000");

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
      doc.save(filename);
      setIsStoreKeeperModalOpen(false);
      setSelectedDeliveryIds(new Set());
      toast({
        title: "List generated",
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

  return (
    <AppPageShell
      subtitle="Assign drivers to sales orders that are still New on fulfillment. Eligible orders leave this list once you save a delivery."
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsStoreKeeperModalOpen(true)}
          >
            Prepare store keeper list
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link href="/app/delivery-notes/new">
              <Plus className="h-4 w-4" />
              New delivery
            </Link>
          </Button>
        </div>
      }
    >
      <Card>
        <CardContent className="p-0 sm:p-2">
          <div className="grid gap-3 p-3 sm:grid-cols-3">
            <Input
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              placeholder="Filter by driver"
            />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            <Input
              value={createdAtFilter}
              onChange={(e) => setCreatedAtFilter(e.target.value)}
              placeholder="Filter by created at"
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delivery ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[220px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <div className="flex flex-col items-center justify-center gap-3 py-14 px-4 text-center">
                        <PackageOpen className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground max-w-md">
                          No delivery notes yet. Each new delivery starts with status{" "}
                          <span className="font-medium text-foreground">New</span>. Create one
                          to assign active sales orders (fulfillment New) to a driver.
                        </p>
                        <Button asChild variant="outline" size="sm">
                          <Link href="/app/delivery-notes/new">New delivery</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.id}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {fmtWhen(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DeliveryNoteStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="font-medium">{r.driverDisplay}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.orderCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {fmtMoney(r.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          {!r.driverStatus ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => setDriverBalanceRow(r)}
                            >
                              Driver Balanced
                            </Button>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                              Money collected from driver
                            </span>
                          )}
                          <Button variant="outline" size="sm" className="gap-1.5" asChild>
                            <Link href={`/app/delivery-notes/${r.id}`}>
                              <Eye className="h-4 w-4" aria-hidden />
                              View
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
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
              Select one or more delivery notes to generate a Product + Qty PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No delivery notes available.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
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
              onClick={generateStoreKeeperList}
              disabled={generatingStoreKeeperList || rows.length === 0}
            >
              {generatingStoreKeeperList ? "Generating..." : "Generate list"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!driverBalanceRow}
        onOpenChange={(open) => {
          if (!open) {
            setDriverBalanceRow(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Driver Balance Preview</DialogTitle>
            <DialogDescription>
              Review the amount to return to owner before confirming.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Driver</span>
                <span className="font-medium">{driverBalanceRow?.driverDisplay ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Delivery ID</span>
                <span className="font-mono text-xs">{driverBalanceRow?.id ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sales order total</span>
                <span className="font-medium">{fmtMoney(selectedDeliveryTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Driver daily rate</span>
                <span className="font-medium">{fmtMoney(selectedDriverRate)}</span>
              </div>
              <div className="border-t pt-2 flex items-center justify-between text-base">
                <span className="font-semibold">Amount to return to owner</span>
                <span className="font-bold">{fmtMoney(amountToReturnOwner)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDriverBalanceRow(null)}
              disabled={confirmingDriverBalance}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmDriverBalance()}
              disabled={confirmingDriverBalance}
            >
              {confirmingDriverBalance ? "Confirming..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
