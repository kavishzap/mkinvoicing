"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Download,
  Eye,
  MoreVertical,
  Plus,
  Printer,
  PackageOpen,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { DeliveryNoteStatusBadge } from "@/components/delivery-note-status-badge";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import {
  DELIVERY_NOTE_STATUS_LABELS,
  getDelivery,
  getDeliveryDriverSettlement,
  getDriverStockReturnContext,
  insertDeliveryDriverSettlement,
  deleteDeliveryDriverSettlement,
  listDeliveries,
  listDriverTeamMembers,
  returnDriverStockToWarehouse,
  setDeliveryDriverStatus,
  type DeliveryListRow,
  type DriverStockReturnLine,
} from "@/lib/deliveries-service";
import type { TeamMemberRow } from "@/lib/company-team-service";
import { addExpense, deleteExpense } from "@/lib/expenses-service";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** No date filter: include all matching sales orders on the delivery for stock return. */
const DRIVER_STOCK_RETURN_P_DAYS_ALL = 0;

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

function fmtMoneyCurrency(n: number, currency: string) {
  const ccy = currency?.trim() || "MUR";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${ccy} ${n.toFixed(2)}`;
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

function parseMoneyInput(s: string): number {
  const t = String(s).trim().replace(/,/g, "");
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Same dark header bar as store keeper PDF exports (MoLedger + title strip). */
function drawMoLedgerExportPdfHeader(
  doc: jsPDF,
  opts: {
    margin: number;
    pageW: number;
    rightTitle: string;
    rightSubtitle?: string;
    leftSubtitle?: string;
  }
) {
  const { margin, pageW, rightTitle, rightSubtitle, leftSubtitle } = opts;
  const rightX = pageW - margin;
  const brandColor = "#0F172A";
  doc.setFillColor(brandColor);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("MoLedger", margin, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(leftSubtitle ?? "Operations export", margin, 46);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(rightTitle, rightX, 30, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (rightSubtitle) doc.text(rightSubtitle, rightX, 46, { align: "right" });
  doc.setTextColor("#000000");
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
  const [stockReturnLines, setStockReturnLines] = useState<DriverStockReturnLine[]>([]);
  const [driverStockAvailable, setDriverStockAvailable] = useState<Record<string, number>>(
    {}
  );
  const [stockLinesLoading, setStockLinesLoading] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [stockReturnBusy, setStockReturnBusy] = useState(false);
  const driverTeamLoadedRef = useRef(false);
  const [driverBalanceModalStep, setDriverBalanceModalStep] = useState<
    "preview" | "payment"
  >("preview");
  const [settlementCashInput, setSettlementCashInput] = useState("");
  const [settlementBankInput, setSettlementBankInput] = useState("");
  const [settlementBankReference, setSettlementBankReference] = useState("");
  const [balanceSheetBusyId, setBalanceSheetBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const list = await listDeliveries();
        if (!cancelled) {
          setRows(list);
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

  useEffect(() => {
    if (!driverBalanceRow) {
      setStockReturnLines([]);
      setDriverStockAvailable({});
      setReturnQtys({});
      driverTeamLoadedRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      setStockLinesLoading(true);
      try {
        const fetchTeam = !driverTeamLoadedRef.current;
        const settled = await Promise.allSettled([
          getDriverStockReturnContext(driverBalanceRow.id, {
            p_days: DRIVER_STOCK_RETURN_P_DAYS_ALL,
          }),
          fetchTeam ? listDriverTeamMembers() : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const ctxResult = settled[0];
        const teamResult = settled[1];
        if (ctxResult.status === "rejected") {
          throw ctxResult.reason;
        }
        const ctx = ctxResult.value;
        if (
          fetchTeam &&
          teamResult.status === "fulfilled" &&
          teamResult.value
        ) {
          setDrivers(teamResult.value);
          driverTeamLoadedRef.current = true;
        } else if (fetchTeam && teamResult.status === "rejected") {
          const err = teamResult.reason as { message?: string };
          toast({
            title: "Could not load driver list",
            description: err?.message ?? "Driver rate may be unavailable.",
            variant: "destructive",
          });
        }
        setStockReturnLines(ctx.lines);
        setDriverStockAvailable(ctx.availableByProduct);
        const init: Record<string, string> = {};
        for (const l of ctx.lines) {
          const avail = ctx.availableByProduct[l.productId] ?? 0;
          init[l.productId] =
            avail > 0 ? String(Math.min(l.deliveryQty, avail)) : "";
        }
        setReturnQtys(init);
      } catch (e: unknown) {
        if (!cancelled) {
          const err = e as { message?: string };
          toast({
            title: "Could not load returnable stock",
            description: err?.message ?? "Please try again.",
            variant: "destructive",
          });
          setStockReturnLines([]);
          setDriverStockAvailable({});
          setReturnQtys({});
        }
      } finally {
        if (!cancelled) setStockLinesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverBalanceRow, toast]);

  const selectedDriverBalanceMember = useMemo(
    () =>
      drivers.find((d) => d.userId === (driverBalanceRow?.driverUserId ?? "")) ??
      null,
    [drivers, driverBalanceRow]
  );
  const selectedDriverRate = Number(selectedDriverBalanceMember?.driverRate ?? 0);
  const selectedDeliveryTotalAll = Number(driverBalanceRow?.totalAmount ?? 0);
  const selectedSettlementCashTotal = Number(
    driverBalanceRow?.totalAmountCashForSettlement ?? 0
  );
  const amountToReturnOwner = selectedSettlementCashTotal - selectedDriverRate;
  const dueRounded = roundMoney2(amountToReturnOwner);

  const settlementCashParsed = useMemo(
    () => parseMoneyInput(settlementCashInput),
    [settlementCashInput]
  );
  const settlementBankParsed = useMemo(
    () => parseMoneyInput(settlementBankInput),
    [settlementBankInput]
  );
  const settlementSplitSum = useMemo(() => {
    if (!Number.isFinite(settlementCashParsed) || !Number.isFinite(settlementBankParsed)) {
      return NaN;
    }
    return roundMoney2(settlementCashParsed + settlementBankParsed);
  }, [settlementCashParsed, settlementBankParsed]);

  const settlementPaymentReady = useMemo(() => {
    if (!Number.isFinite(settlementCashParsed) || !Number.isFinite(settlementBankParsed)) {
      return false;
    }
    if (dueRounded <= 0) {
      return settlementCashParsed === 0 && settlementBankParsed === 0;
    }
    return (
      settlementSplitSum === dueRounded &&
      (settlementCashParsed > 0 || settlementBankParsed > 0)
    );
  }, [dueRounded, settlementBankParsed, settlementCashParsed, settlementSplitSum]);

  useEffect(() => {
    setDriverBalanceModalStep("preview");
    setSettlementCashInput("");
    setSettlementBankInput("");
    setSettlementBankReference("");
  }, [driverBalanceRow?.id]);

  const closeDriverBalanceModal = useCallback(() => {
    setDriverBalanceRow(null);
    setDriverBalanceModalStep("preview");
    setSettlementCashInput("");
    setSettlementBankInput("");
    setSettlementBankReference("");
  }, []);

  async function submitDriverStockReturns() {
    if (!driverBalanceRow) return;
    const driverId = driverBalanceRow.driverUserId;
    const entries: { productId: string; productName: string; qty: number }[] = [];
    for (const l of stockReturnLines) {
      const raw = returnQtys[l.productId] ?? "";
      const qty = Number(raw);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const avail = driverStockAvailable[l.productId] ?? 0;
      if (qty > avail) {
        toast({
          title: "Quantity too high",
          description: `For “${l.productName}”, the driver only has ${avail} on hand. Lower the return quantity.`,
          variant: "destructive",
        });
        return;
      }
      entries.push({ productId: l.productId, productName: l.productName, qty });
    }
    if (entries.length === 0) {
      toast({
        title: "Nothing to return",
        description: "Enter a return quantity greater than zero for at least one product.",
        variant: "destructive",
      });
      return;
    }

    try {
      setStockReturnBusy(true);
      for (const { productId, qty } of entries) {
        await returnDriverStockToWarehouse({
          driverUserId: driverId,
          productId,
          quantity: qty,
        });
      }
      toast({
        title: "Stock returned to warehouse",
        description: `${entries.length} product line(s): transfer from driver to primary warehouse (return_driver_stock_to_warehouse).`,
      });
      const ctx = await getDriverStockReturnContext(driverBalanceRow.id, {
        p_days: DRIVER_STOCK_RETURN_P_DAYS_ALL,
      });
      setStockReturnLines(ctx.lines);
      setDriverStockAvailable(ctx.availableByProduct);
      const next: Record<string, string> = {};
      for (const l of ctx.lines) {
        const avail = ctx.availableByProduct[l.productId] ?? 0;
        next[l.productId] =
          avail > 0 ? String(Math.min(l.deliveryQty, avail)) : "";
      }
      setReturnQtys(next);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Stock return failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setStockReturnBusy(false);
    }
  }

  async function completeDriverBalanceSettlement() {
    if (!driverBalanceRow) return;
    if (!settlementPaymentReady) {
      toast({
        title: "Check payment split",
        description:
          dueRounded > 0
            ? "Enter cash and/or bank amounts that add up to the amount due."
            : "For this net amount, leave both cash and bank at zero.",
        variant: "destructive",
      });
      return;
    }

    const cashAmt = settlementCashParsed;
    const bankAmt = settlementBankParsed;
    const refTrim = settlementBankReference.trim();

    let expenseId: string | null = null;
    let settlementId: string | null = null;
    try {
      setConfirmingDriverBalance(true);
      const rate = Number(selectedDriverRate);
      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error("Driver rate is missing or invalid. Set it in Company Team first.");
      }

      const parts: string[] = [];
      if (cashAmt > 0) parts.push(`Cash ${fmtMoney(cashAmt)}`);
      if (bankAmt > 0) parts.push(`Bank transfer ${fmtMoney(bankAmt)}`);
      const paymentSummary =
        parts.length > 0 ? parts.join(" · ") : "No cash movement (net ≤ 0)";
      const refNote = refTrim ? ` Reference: ${refTrim}.` : "";

      const expenseNotes =
        `Settlement cash (orders): ${selectedSettlementCashTotal}. All linked orders: ${selectedDeliveryTotalAll}. Net to return to owner: ${amountToReturnOwner}. ` +
        `Payment to owner: ${paymentSummary}.${refNote}`;

      const expense = await addExpense({
        description: `Driver salary for delivery ${driverBalanceRow.id} (${driverBalanceRow.driverDisplay})`,
        amount: rate,
        currency: "MUR",
        expense_date: new Date().toISOString().slice(0, 10),
        notes: expenseNotes,
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
      expenseId = expense.id;

      const { id: sid } = await insertDeliveryDriverSettlement({
        deliveryId: driverBalanceRow.id,
        driverUserId: driverBalanceRow.driverUserId,
        amountToOwner: dueRounded,
        currency: "MUR",
        settlementCashTotal: selectedSettlementCashTotal,
        driverDailyRate: selectedDriverRate,
        linkedOrdersTotal: selectedDeliveryTotalAll,
        cashAmount: cashAmt,
        bankTransferAmount: bankAmt,
        bankReference: bankAmt > 0 && refTrim ? refTrim : null,
        expenseId: expense.id,
      });
      settlementId = sid;

      await setDeliveryDriverStatus(driverBalanceRow.id, true);

      setRows((prev) =>
        prev.map((r) =>
          r.id === driverBalanceRow.id
            ? {
                ...r,
                driverStatus: true,
                driverCollectedAmount: roundMoney2(cashAmt + bankAmt),
              }
            : r
        )
      );
      toast({
        title: "Driver balance recorded",
        description: "Expense saved, payment logged, and driver status marked as completed.",
      });
      closeDriverBalanceModal();
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (settlementId) {
        try {
          await deleteDeliveryDriverSettlement(settlementId);
        } catch {
          /* ignore rollback errors */
        }
      }
      if (expenseId) {
        try {
          await deleteExpense(expenseId);
        } catch {
          /* ignore rollback errors */
        }
      }
      toast({
        title: "Could not settle driver balance",
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

  const downloadDriverBalanceSheet = useCallback(
    async (listRow: DeliveryListRow, mode: "download" | "print" = "download") => {
      setBalanceSheetBusyId(listRow.id);
      try {
        const [delivery, settlement, team] = await Promise.all([
          getDelivery(listRow.id),
          getDeliveryDriverSettlement(listRow.id),
          listDriverTeamMembers(),
        ]);
        if (!delivery) {
          toast({
            title: "Not found",
            description: "Could not load this delivery.",
            variant: "destructive",
          });
          return;
        }

        const teamRateRaw = team.find((t) => t.userId === listRow.driverUserId)?.driverRate;
        const teamRateNum = Number(teamRateRaw);
        const teamRate = Number.isFinite(teamRateNum) ? roundMoney2(teamRateNum) : null;
        const driverRateForPending =
          settlement?.driverDailyRate != null ? settlement.driverDailyRate : teamRate;
        const settlementCash = listRow.totalAmountCashForSettlement;
        const indicativeDue =
          driverRateForPending != null
            ? roundMoney2(settlementCash - driverRateForPending)
            : null;

        const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 40;

        drawMoLedgerExportPdfHeader(doc, {
          margin,
          pageW,
          leftSubtitle: "Driver balance export",
          rightTitle: "DRIVER BALANCE SHEET",
          rightSubtitle: `Delivery ${listRow.id}`,
        });

        let y = 88;
        doc.setFont("helvetica", "bold").setFontSize(11).text("Summary", margin, y);
        y += 16;
        doc.setFont("helvetica", "normal").setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
        y += 22;

        const metaBody: string[][] = [
          ["Delivery ID", listRow.id],
          ["Delivery note status", DELIVERY_NOTE_STATUS_LABELS[delivery.status]],
          ["Driver balance collected (flag)", delivery.driverStatus ? "Yes" : "No"],
          ["Driver", delivery.driverDisplay],
          ["Created", fmtWhen(delivery.createdAt)],
          ["Created by", delivery.createdByDisplay || "—"],
          ["Scheduled delivery date", fmtScheduleDay(delivery.deliveryDate)],
          ["Sales orders on delivery", String(delivery.salesOrders.length)],
          ["Sum of order totals (linked + pinned)", fmtMoney(listRow.totalAmount)],
        ];

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Field", "Value"]],
          body: metaBody,
          styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 5,
            lineColor: 230,
            lineWidth: 0.3,
            valign: "top",
          },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: 255,
            fontStyle: "bold",
          },
          columnStyles: { 0: { cellWidth: 220 }, 1: { cellWidth: "auto" } },
        });

        let y2 =
          (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
          y + 40;
        y2 += 20;

        let payRows: string[][];
        if (settlement) {
          const ccy = settlement.currency || "MUR";
          payRows = [
            ["Collection status", "Recorded — driver balance settled in app"],
            ["Settlement recorded at", fmtWhen(settlement.createdAt)],
            [
              "Driver daily rate (snapshot)",
              settlement.driverDailyRate != null
                ? fmtMoneyCurrency(settlement.driverDailyRate, ccy)
                : "—",
            ],
            ["Paid to owner in cash", fmtMoneyCurrency(settlement.cashAmount, ccy)],
            [
              "Paid to owner by bank transfer",
              fmtMoneyCurrency(settlement.bankTransferAmount, ccy),
            ],
            ["Bank reference", settlement.bankReference?.trim() || "—"],
            [
              "Cash + bank (paid to owner)",
              fmtMoneyCurrency(
                roundMoney2(settlement.cashAmount + settlement.bankTransferAmount),
                ccy
              ),
            ],
          ];
        } else if (listRow.driverStatus) {
          payRows = [
            [
              "Collection status",
              "Marked collected — no settlement row found (legacy or incomplete data)",
            ],
            ["Paid in cash", "—"],
            ["Paid by bank transfer", "—"],
          ];
        } else {
          payRows = [
            ["Collection status", "PENDING — driver balance not collected yet"],
            [
              "Driver daily rate (from company team)",
              teamRate != null ? fmtMoney(teamRate) : "—",
            ],
            [
              "Indicative amount due to owner (cash orders − driver rate)",
              indicativeDue != null ? fmtMoney(indicativeDue) : "—",
            ],
            ["Paid in cash", "— (pending)"],
            ["Paid by bank transfer", "— (pending)"],
          ];
        }

        doc.setFont("helvetica", "bold").setFontSize(11).text("Payment & collection", margin, y2);
        y2 += 14;

        autoTable(doc, {
          startY: y2,
          margin: { left: margin, right: margin },
          head: [["Item", "Detail"]],
          body: payRows,
          styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 5,
            lineColor: 230,
            lineWidth: 0.3,
            valign: "top",
          },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: 255,
            fontStyle: "bold",
          },
          columnStyles: { 0: { cellWidth: 220 }, 1: { cellWidth: "auto" } },
          didParseCell: (data) => {
            if (
              data.section === "body" &&
              data.column.index === 1 &&
              data.row.index === 0
            ) {
              const raw = data.cell.raw;
              if (typeof raw === "string" && raw.includes("PENDING")) {
                data.cell.styles.textColor = [220, 38, 38];
              }
            }
          },
        });

        const lastH = doc.internal.pageSize.getHeight();
        const lastW = doc.internal.pageSize.getWidth();
        doc.setDrawColor(230);
        doc.line(margin, lastH - 42, lastW - margin, lastH - 42);
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor("#64748B");
        doc.text("Powered by MoLedger", lastW / 2, lastH - 28, { align: "center" });
        doc.text(`Page ${doc.getNumberOfPages()}`, lastW - margin, lastH - 28, {
          align: "right",
        });
        doc.setTextColor(0);

        const safeId = listRow.id.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 32);
        const filename = `DriverBalanceSheet-${safeId}-${new Date().toISOString().slice(0, 10)}.pdf`;
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
        toast({
          title: mode === "print" ? "Opening print dialog" : "Downloaded",
          description: filename,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Could not generate sheet",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setBalanceSheetBusyId(null);
      }
    },
    [toast],
  );

  return (
    <AppPageShell
      subtitle="Assign drivers to sales orders still on New, Pending, or Rescheduled fulfillment. Eligible orders leave this list once you save a delivery."
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
                  <TableHead>Created by</TableHead>
                  <TableHead>Delivery date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="min-w-[140px] text-right">Driver balance</TableHead>
                  <TableHead className="w-14 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="p-0">
                      <div className="flex flex-col items-center justify-center gap-3 py-14 px-4 text-center">
                        <PackageOpen className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground max-w-md">
                          No delivery notes yet. Each new delivery starts with status{" "}
                          <span className="font-medium text-foreground">New</span>. Create one
                          to assign active sales orders (fulfillment New, Pending, or Rescheduled) to a driver.
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
                      <TableCell className="text-muted-foreground">
                        {r.createdByDisplay || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {fmtScheduleDay(r.deliveryDate)}
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
                      <TableCell className="text-right align-top">
                        <div className="flex flex-col items-end gap-0.5 text-sm">
                          {r.driverStatus ? (
                            <>
                              <span className="font-medium text-foreground">
                                Money collected
                                {r.driverCollectedAmount != null ? (
                                  <span className="ml-1 tabular-nums text-muted-foreground">
                                    {fmtMoney(r.driverCollectedAmount)}
                                  </span>
                                ) : null}
                              </span>
                              {r.driverCollectedAmount == null ? (
                                <span className="text-xs font-medium text-emerald-700">Settled</span>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground">—</span>
                              <span className="text-xs font-medium text-destructive">
                                Collection pending
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Actions for delivery ${r.id}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem asChild>
                              <Link href={`/app/delivery-notes/${r.id}`}>
                                <Eye className="mr-2 h-4 w-4" aria-hidden />
                                View
                              </Link>
                            </DropdownMenuItem>
                            {!r.driverStatus ? (
                              <DropdownMenuItem onClick={() => setDriverBalanceRow(r)}>
                                <Banknote className="mr-2 h-4 w-4" aria-hidden />
                                Driver balance (not collected yet)
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={balanceSheetBusyId === r.id}
                              onClick={() => void downloadDriverBalanceSheet(r)}
                            >
                              <Download className="mr-2 h-4 w-4" aria-hidden />
                              {balanceSheetBusyId === r.id
                                ? "Preparing PDF…"
                                : "Download driver balance sheet"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={balanceSheetBusyId === r.id}
                              onClick={() => void downloadDriverBalanceSheet(r, "print")}
                            >
                              <Printer className="mr-2 h-4 w-4" aria-hidden />
                              {balanceSheetBusyId === r.id
                                ? "Preparing PDFâ€¦"
                                : "Print driver balance sheet"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
      <Dialog
        open={!!driverBalanceRow}
        onOpenChange={(open) => {
          if (!open) {
            closeDriverBalanceModal();
          }
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-4 overflow-y-auto sm:w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>
              {driverBalanceModalStep === "payment"
                ? "Payment to owner"
                : "Driver Balance Preview"}
            </DialogTitle>
            <DialogDescription>
              {driverBalanceModalStep === "payment"
                ? "Choose how the driver returned the net amount to you, then complete settlement."
                : "Return unsold stock to the primary warehouse, then review cash to return to the owner before settling."}
            </DialogDescription>
          </DialogHeader>
          {driverBalanceModalStep === "preview" ? (
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
                  <span className="text-muted-foreground">Cash for settlement (orders)</span>
                  <span className="font-medium">{fmtMoney(selectedSettlementCashTotal)}</span>
                </div>
                {driverBalanceRow &&
                selectedDeliveryTotalAll !== selectedSettlementCashTotal ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>All linked orders (reference)</span>
                    <span className="tabular-nums">{fmtMoney(selectedDeliveryTotalAll)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Driver daily rate</span>
                  <span className="font-medium">{fmtMoney(selectedDriverRate)}</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between text-base">
                  <span className="font-semibold">Amount to return to owner</span>
                  <span className="font-bold">{fmtMoney(amountToReturnOwner)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Warehouse className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Return driver stock to warehouse</p>
                    <p className="text-xs text-muted-foreground">
                      All matching lines on this delivery (any order update date).
                    </p>
                  </div>
                </div>

                {stockLinesLoading ? (
                  <p className="text-sm text-muted-foreground py-4">Loading products…</p>
                ) : stockReturnLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                    {driverBalanceRow && driverBalanceRow.orderCount > 0
                      ? "No matching lines: need fulfillment Delivered to driver, Rescheduled, or Pending, with catalog-linked line items on this delivery."
                      : "No products on this delivery."}
                  </p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Product</TableHead>
                          <TableHead className="min-w-[220px]">Sales orders</TableHead>
                          <TableHead className="text-right whitespace-nowrap">
                            Line qty
                          </TableHead>
                          <TableHead className="text-right whitespace-nowrap">On driver</TableHead>
                          <TableHead className="w-[120px] text-right">Return qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockReturnLines.map((l) => {
                          const onDriver = driverStockAvailable[l.productId] ?? 0;
                          return (
                            <TableRow key={l.productId}>
                              <TableCell className="font-medium max-w-[220px] align-top">
                                <span className="line-clamp-3">{l.productName}</span>
                              </TableCell>
                              <TableCell className="align-top text-xs leading-snug">
                                {l.salesOrders.length === 0 ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <ul className="space-y-2">
                                    {l.salesOrders.map((so) => (
                                      <li key={so.salesOrderId} className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-medium text-foreground">
                                            #{so.salesOrderNumber}
                                          </span>
                                          <SalesOrderFulfillmentStatusBadge
                                            status={so.fulfillmentStatus}
                                            className="h-5 shrink-0 px-1.5 text-[10px]"
                                          />
                                        </div>
                                        <div className="text-xs">
                                          <span className="tabular-nums">
                                            {fmtMoneyCurrency(so.salesOrderTotal, so.currency)}
                                          </span>
                                          <span className="text-muted-foreground"> · qty </span>
                                          <span className="tabular-nums font-medium text-foreground">
                                            {so.qty}
                                          </span>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums align-top">
                                {l.deliveryQty}
                              </TableCell>
                              <TableCell className="text-right tabular-nums align-top">{onDriver}</TableCell>
                              <TableCell className="text-right align-top">
                                <Label htmlFor={`ret-qty-${l.productId}`} className="sr-only">
                                  Return quantity for {l.productName}
                                </Label>
                                <Input
                                  id={`ret-qty-${l.productId}`}
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="h-8 w-full text-right tabular-nums"
                                  value={returnQtys[l.productId] ?? ""}
                                  onChange={(e) =>
                                    setReturnQtys((prev) => ({
                                      ...prev,
                                      [l.productId]: e.target.value,
                                    }))
                                  }
                                  disabled={stockReturnBusy || confirmingDriverBalance}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="min-w-0 space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Amount to return to owner</span>
                  <span className="font-semibold tabular-nums">{fmtMoney(amountToReturnOwner)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Split between cash and bank transfer; both can be used. The two amounts must add
                  up to the figure above (when it is greater than zero).
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="settlement-cash-amt">Cash (MUR)</Label>
                  <Input
                    id="settlement-cash-amt"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={settlementCashInput}
                    onChange={(e) => setSettlementCashInput(e.target.value)}
                    disabled={confirmingDriverBalance}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settlement-bank-amt">Bank transfer (MUR)</Label>
                  <Input
                    id="settlement-bank-amt"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={settlementBankInput}
                    onChange={(e) => setSettlementBankInput(e.target.value)}
                    disabled={confirmingDriverBalance}
                    placeholder="0"
                  />
                </div>
              </div>

              {settlementBankParsed > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="settlement-bank-reference">Reference (optional)</Label>
                  <Input
                    id="settlement-bank-reference"
                    placeholder="e.g. transfer ref, transaction ID"
                    value={settlementBankReference}
                    onChange={(e) => setSettlementBankReference(e.target.value)}
                    disabled={confirmingDriverBalance}
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Add a bank reference if you have one; it is not required to complete settlement.
                  </p>
                </div>
              ) : null}

              {dueRounded > 0 ? (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    Number.isFinite(settlementSplitSum) && settlementSplitSum === dueRounded
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                      : "border-border bg-muted/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">Total allocated</span>
                    <span className="font-medium tabular-nums">
                      {Number.isFinite(settlementSplitSum) ? fmtMoney(settlementSplitSum) : "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Must equal</span>
                    <span className="font-medium tabular-nums">{fmtMoney(dueRounded)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2">
                  Net to owner is zero or negative — leave cash and bank at zero and complete
                  settlement.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            {driverBalanceModalStep === "preview" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeDriverBalanceModal()}
                  disabled={confirmingDriverBalance || stockReturnBusy}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  disabled={
                    stockReturnBusy ||
                    confirmingDriverBalance ||
                    stockLinesLoading ||
                    stockReturnLines.length === 0
                  }
                  onClick={() => void submitDriverStockReturns()}
                >
                  {stockReturnBusy ? "Returning…" : "Return stock to warehouse"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const due = roundMoney2(
                      selectedSettlementCashTotal - selectedDriverRate
                    );
                    if (due > 0) {
                      setSettlementCashInput(String(due));
                      setSettlementBankInput("");
                    } else {
                      setSettlementCashInput("");
                      setSettlementBankInput("");
                    }
                    setSettlementBankReference("");
                    setDriverBalanceModalStep("payment");
                  }}
                  disabled={confirmingDriverBalance || stockReturnBusy}
                >
                  Settle
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDriverBalanceModalStep("preview")}
                  disabled={confirmingDriverBalance}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => void completeDriverBalanceSettlement()}
                  disabled={
                    confirmingDriverBalance ||
                    stockReturnBusy ||
                    !settlementPaymentReady
                  }
                >
                  {confirmingDriverBalance ? "Settling…" : "Complete settlement"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
