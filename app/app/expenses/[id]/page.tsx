"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, ListOrdered, Receipt, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getExpense, type ExpenseRow } from "@/lib/expenses-service";
import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { AppPageShell } from "@/components/app-page-shell";
import { cn } from "@/lib/utils";

const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 px-4 py-5 text-sm">
        {children}
      </CardContent>
    </Card>
  );
}

async function imageUrlToDataURL(
  url: string,
): Promise<{ dataUrl: string; fmt: "PNG" | "JPEG" } | undefined> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const fmt: "PNG" | "JPEG" = blob.type.includes("png") ? "PNG" : "JPEG";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { dataUrl, fmt };
  } catch {
    return undefined;
  }
}

async function generateExpensePDF(expense: ExpenseRow, profile: Profile | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;

  const brandColor: [number, number, number] = [15, 23, 42];

  const senderName = profile?.companyName || profile?.fullName || "Your Company";
  const senderEmail = profile?.email || "";
  const resolvedLogo = profile?.logoUrl || "/kredence.png";

  const currency = expense.currency || "MUR";

  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(n);

  const fmtDatePdf = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageW, 60, "F");

  const logoImg = resolvedLogo ? await imageUrlToDataURL(resolvedLogo) : undefined;
  if (logoImg?.dataUrl) {
    doc.addImage(logoImg.dataUrl, logoImg.fmt, M, 14, 48, 48, undefined, "FAST");
  }

  const headerTextX = M + 60;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text("EXPENSE", headerTextX, 30);
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(senderName, headerTextX, 48);
  if (senderEmail) {
    doc.text(senderEmail, pageW - M, 48, { align: "right" });
  }

  doc.setTextColor(0, 0, 0);

  let y = 90;

  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text("Expense Summary", M, y);
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(10);

  const summaryLines = [
    `Description: ${expense.description || "—"}`,
    `Date: ${fmtDatePdf(expense.expense_date)}`,
    `Currency: ${currency}`,
    `Total Amount: ${money(Number(expense.amount || 0))}`,
  ];
  summaryLines.forEach((line) => {
    doc.text(line, M, y);
    y += 14;
  });

  if (expense.notes) {
    y += 8;
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("Notes", M, y);
    y += 14;
    doc.setFont("helvetica", "normal").setFontSize(10);
    const wrapped = doc.splitTextToSize(expense.notes, pageW - 2 * M);
    doc.text(wrapped, M, y);
    y += wrapped.length * 13;
  }

  y += 18;

  const bodyRows: RowInput[] = (expense.line_items ?? []).map((li) => {
    const qty = Number(li.quantity ?? 0);
    const unit = Number(li.unit_price ?? 0);
    const tax = Number(li.tax_percent ?? 0);
    const lineTotal = Number(li.line_total ?? qty * unit * (1 + tax / 100));
    return [
      li.item || "",
      li.description || "",
      qty.toString(),
      money(unit),
      `${tax || 0}%`,
      money(lineTotal),
    ];
  });

  autoTable(doc, {
    head: [["Item", "Description", "Qty", "Unit Price", "Tax %", "Total"]],
    body: bodyRows,
    startY: y,
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 6,
      lineColor: 230,
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: brandColor,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      2: { halign: "right", cellWidth: 40 },
      3: { halign: "right", cellWidth: 80 },
      4: { halign: "right", cellWidth: 50 },
      5: { halign: "right", cellWidth: 90 },
    },
    margin: { left: M, right: M },
  });

  const totalAmount = Number(expense.amount || 0);
  const afterTableY = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? y;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Total Amount", pageW - M - 150, afterTableY + 24);
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(money(totalAmount), pageW - M, afterTableY + 24, {
    align: "right",
  });

  doc.setDrawColor(230);
  doc.line(M, pageH - 50, pageW - M, pageH - 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Powered by MoLedger", pageW / 2, pageH - 35, {
    align: "center",
  });
  doc.setTextColor(0, 0, 0);

  const filename = `Expense-${fmtDatePdf(expense.expense_date)}.pdf`;
  doc.save(filename);
}

export default function ExpenseViewPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<ExpenseRow | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [expRes, profRes] = await Promise.allSettled([
          getExpense(id),
          fetchProfile(),
        ]);
        if (cancelled) return;

        if (expRes.status === "fulfilled") {
          setExpense(expRes.value);
        } else {
          setExpense(null);
          const reason =
            expRes.reason instanceof Error
              ? expRes.reason.message
              : "Failed to load expense.";
          setError(reason);
          toast({
            title: "Failed to load expense",
            description: reason,
            variant: "destructive",
          });
        }

        if (profRes.status === "fulfilled") {
          setProfile(profRes.value);
        } else {
          setProfile(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setExpense(null);
          const msg = e instanceof Error ? e.message : "Failed to load expense.";
          setError(msg);
          toast({
            title: "Failed to load expense",
            description: msg,
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

  const fmtDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  const fmtMoney = (amt: number, ccy: string) =>
    `${ccy} ${amt.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const shellCommon = {
    fillHeight: true as const,
    className:
      "max-w-none px-3 sm:px-4 md:px-5 lg:px-6",
  };

  if (!loading && !expense) {
    return (
      <AppPageShell {...shellCommon}>
        <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold mb-2">Expense not found</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {error ?? "The expense you're looking for doesn't exist."}
            </p>
            <Button asChild>
              <Link href="/app/expenses">Back to expenses</Link>
            </Button>
          </div>
        </div>
      </AppPageShell>
    );
  }

  if (loading || !expense) {
    return (
      <AppPageShell {...shellCommon}>
        <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="h-10 w-48 animate-pulse rounded bg-muted" />
            <div className="h-9 w-36 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-56 animate-pulse rounded-lg bg-muted" />
            <div className="h-56 animate-pulse rounded-lg bg-muted lg:col-span-1" />
          </div>
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
      </AppPageShell>
    );
  }

  const total = Number(expense.amount || 0);
  const ccy = expense.currency || "MUR";

  return (
    <AppPageShell
      {...shellCommon}
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to expenses">
          <Link href="/app/expenses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      subtitle={`${fmtDate(expense.expense_date)}${expense.description ? ` · ${expense.description}` : ""}. Review line items or download a PDF.`}
      actions={
        <Button
          variant="outline"
          className="gap-2 rounded-md font-semibold shadow-sm print:hidden"
          onClick={async () => {
            try {
              await generateExpensePDF(expense, profile);
            } catch (e: unknown) {
              toast({
                title: "Failed to generate PDF",
                description: e instanceof Error ? e.message : "Please try again.",
                variant: "destructive",
              });
            }
          }}
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          Download PDF
        </Button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="flex min-w-0 flex-col gap-1 border-b border-border/60 pb-4">
          <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
            {expense.description || "Expense"}
          </h2>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{fmtDate(expense.expense_date)}</span>
            <span>·</span>
            <span className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-medium tabular-nums">
              {ccy}
            </span>
          </p>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <SectionCard icon={Receipt} title="Summary">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="mt-1 font-medium text-foreground">
                  {expense.description || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Date</p>
                <p className="mt-1 font-medium tabular-nums">{fmtDate(expense.expense_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Currency</p>
                <p className="mt-1 font-medium">{ccy}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Total amount</p>
                <p className="mt-2 inline-flex items-center rounded-md bg-emerald-500/12 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/14 dark:text-emerald-200">
                  {fmtMoney(total, ccy)}
                </p>
              </div>
            </div>
            {expense.notes ? (
              <div className="rounded-md border border-border/60 bg-muted/25 p-3">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-foreground/90">{expense.notes}</p>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard icon={ListOrdered} title="Line items">
            <div className="rounded-md border border-border/80 overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="border-b bg-muted/35">
                  <tr>
                    <th className="text-left p-2.5 font-semibold">Item</th>
                    <th className="text-left p-2.5 font-semibold">Description</th>
                    <th className="text-right p-2.5 font-semibold">Qty</th>
                    <th className="text-right p-2.5 font-semibold">Unit</th>
                    <th className="text-right p-2.5 font-semibold">Tax %</th>
                    <th className="text-right p-2.5 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(expense.line_items ?? []).length > 0 ? (
                    expense.line_items.map((li, idx) => (
                      <tr
                        key={`${li.item}-${idx}`}
                        className={cn(
                          "border-b border-border/40 last:border-b-0",
                          idx % 2 === 1 && "bg-muted/15",
                        )}
                      >
                        <td className="p-2.5 align-top">
                          {li.item || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-2.5 align-top text-muted-foreground">
                          {li.description || "—"}
                        </td>
                        <td className="p-2.5 text-right tabular-nums align-top">
                          {Number(li.quantity ?? 0).toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-2.5 text-right tabular-nums align-top">
                          {fmtMoney(Number(li.unit_price ?? 0), ccy)}
                        </td>
                        <td className="p-2.5 text-right tabular-nums align-top">
                          {Number(li.tax_percent ?? 0).toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-2.5 text-right tabular-nums font-medium align-top">
                          {fmtMoney(Number(li.line_total ?? 0), ccy)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No line items for this expense.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
              <span className="text-muted-foreground">Total amount</span>
              <span className="inline-flex items-center rounded-md bg-emerald-500/12 px-3 py-1 font-semibold text-emerald-800 dark:bg-emerald-500/14 dark:text-emerald-200 tabular-nums">
                {fmtMoney(total, ccy)}
              </span>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppPageShell>
  );
}
