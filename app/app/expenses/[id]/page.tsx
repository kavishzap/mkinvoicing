 "use client";
 export const dynamic = "force-dynamic";

 import { useEffect, useState } from "react";
 import { useParams, useRouter } from "next/navigation";
 import Link from "next/link";
 import { ArrowLeft, Download } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Separator } from "@/components/ui/separator";
 import { useToast } from "@/hooks/use-toast";
import { getExpense, type ExpenseRow } from "@/lib/expenses-service";
import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";
import { fetchProfile, type Profile } from "@/lib/settings-service";

async function imageUrlToDataURL(
  url: string
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

   const brandColor: [number, number, number] = [15, 23, 42]; // slate-900

   const senderName =
     (profile as any)?.companyName ||
     (profile as any)?.fullName ||
     "Your Company";
   const senderEmail = (profile as any)?.email || "";
  const resolvedLogo =
    (profile as any)?.logoUrl ||
    (profile as any)?.logo_url ||
    "/kredence.png";

   const currency = expense.currency || "MUR";

   const money = (n: number) =>
     new Intl.NumberFormat("en-US", {
       style: "currency",
       currency,
     }).format(n);

   const fmtDate = (d?: string) =>
     d
       ? new Date(d).toLocaleDateString("en-GB", {
           day: "2-digit",
           month: "2-digit",
           year: "numeric",
         })
       : "—";

  // Header bar
  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageW, 60, "F");

  // Logo (left)
  const logoImg = resolvedLogo
    ? await imageUrlToDataURL(resolvedLogo)
    : undefined;
  if (logoImg?.dataUrl) {
    doc.addImage(logoImg.dataUrl, logoImg.fmt, M, 14, 48, 48, undefined, "FAST");
  }

  // Title + sender (right of logo)
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

   // Summary block
   doc.setFont("helvetica", "bold").setFontSize(12);
   doc.text("Expense Summary", M, y);
   y += 16;
   doc.setFont("helvetica", "normal").setFontSize(10);

   const summaryLines = [
     `Description: ${expense.description || "—"}`,
     `Date: ${fmtDate(expense.expense_date)}`,
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

   // Line items table
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
  const afterTableY = (doc as any).lastAutoTable?.finalY ?? y;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Total Amount", pageW - M - 150, afterTableY + 24);
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(money(totalAmount), pageW - M, afterTableY + 24, {
    align: "right",
  });

  // Footer: separator + powered by
  doc.setDrawColor(230);
  doc.line(M, pageH - 50, pageW - M, pageH - 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("Powered by MoLedger", pageW / 2, pageH - 35, {
    align: "center",
  });
  doc.setTextColor(0, 0, 0);

  const filename = `Expense-${fmtDate(expense.expense_date)}.pdf`;
   doc.save(filename);
 }

 export default function ExpenseViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
          setError(expRes.reason?.message ?? "Failed to load expense.");
          toast({
            title: "Failed to load expense",
            description: expRes.reason?.message ?? "Please try again.",
            variant: "destructive",
          });
        }

        if (profRes.status === "fulfilled") {
          setProfile(profRes.value);
        } else {
          setProfile(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setExpense(null);
          setError(e?.message ?? "Failed to load expense.");
          toast({
            title: "Failed to load expense",
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

  if (!loading && !expense) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <h2 className="text-2xl font-semibold mb-2">Expense not found</h2>
            <p className="text-muted-foreground mb-6">
              {error ?? "The expense you're looking for doesn't exist."}
            </p>
            <Link href="/app/expenses">
              <Button>Back to Expenses</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !expense) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
          <div className="h-9 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-80 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const total = Number(expense.amount || 0);
  const ccy = expense.currency || "MUR";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/app/expenses")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Expense {fmtDate(expense.expense_date)}
            </h1>
            <p className="text-muted-foreground mt-1">
              View expense details and line items
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={async () => {
            try {
              await generateExpensePDF(expense, profile);
            } catch (e: any) {
              toast({
                title: "Failed to generate PDF",
                description: e?.message ?? "Please try again.",
                variant: "destructive",
              });
            }
          }}
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Expense Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-6 items-start">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                Description
              </p>
              <p className="mt-1 font-medium">
                {expense.description || "—"}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                Date
              </p>
              <p className="mt-1 font-medium">{fmtDate(expense.expense_date)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                Currency
              </p>
              <p className="mt-1 font-medium">{ccy}</p>
            </div>
            <div className="sm:col-span-1">
              <p className="text-sm font-semibold text-muted-foreground">
                Total Amount
              </p>
              <p className="mt-2 inline-flex items-center rounded-md bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                {fmtMoney(total, ccy)}
              </p>
            </div>
          </div>

          {expense.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Notes
                </p>
                <p className="mt-1 text-sm">{expense.notes}</p>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">
              Line Items
            </p>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 w-[160px]">Item</th>
                    <th className="text-left p-2 w-[220px]">Description</th>
                    <th className="text-right p-2 w-[80px]">Qty</th>
                    <th className="text-right p-2 w-[110px]">Unit Price</th>
                    <th className="text-right p-2 w-[90px]">Tax %</th>
                    <th className="text-right p-2 w-[120px]">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(expense.line_items ?? []).length > 0 ? (
                    expense.line_items.map((li, idx) => (
                      <tr key={`${li.item}-${idx}`} className="border-t">
                        <td className="p-2">
                          {li.item || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-2">
                          {li.description || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {Number(li.quantity ?? 0).toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-2 text-right">
                          {fmtMoney(Number(li.unit_price ?? 0), ccy)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(li.tax_percent ?? 0).toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-2 text-right">
                          {fmtMoney(Number(li.line_total ?? 0), ccy)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-6 text-center text-muted-foreground"
                      >
                        No line items for this expense.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-3 border-t text-sm">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                {fmtMoney(total, ccy)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

