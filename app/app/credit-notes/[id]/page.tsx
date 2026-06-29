"use client";
import { DetailDocumentPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import nextDynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditNoteStatusBadge } from "@/components/credit-note-status-badge";
import { CompactBillToSummary } from "@/components/compact-bill-to-summary";
import { useToast } from "@/hooks/use-toast";
import {
  getCreditNote,
  getCachedCreditNote,
  computeCreditNoteTotals,
  creditNoteReasonLabel,
  invalidateCreditNoteCaches,
  type CreditNoteDetail,
  type CreditNoteItemRow,
} from "@/lib/credit-notes-service";
import { AppPageShell } from "@/components/app-page-shell";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { fetchProfile, type Profile } from "@/lib/settings-service";

const CreditNoteViewActions = nextDynamic(
  () =>
    import("@/components/credit-note-view-actions").then(
      (m) => m.CreditNoteViewActions,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-9 w-48 animate-pulse rounded-md bg-muted/70" />
    ),
  },
);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(amt: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amt);
}

export default function CreditNoteViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [loading, setLoading] = useState(true);
  const [creditNote, setCreditNote] = useState<CreditNoteDetail | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const bump = () => {
      invalidateCreditNoteCaches();
      setRefreshKey((n) => n + 1);
    };
    window.addEventListener(ACTIVE_COMPANY_CHANGED_EVENT, bump);
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_COMPANY_ID_STORAGE_KEY) bump();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ACTIVE_COMPANY_CHANGED_EVENT, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setError(null);

    (async () => {
      const companyId = await getActiveCompanyId();
      const cached = companyId ? getCachedCreditNote(companyId, id) : null;
      if (cancelled) return;

      if (cached) {
        setCreditNote(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const cnPromise = getCreditNote(id);
      const profilePromise = fetchProfile();

      cnPromise
        .then((cn) => {
          if (cancelled) return;
          setCreditNote(cn);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setCreditNote(null);
          setError(
            e instanceof Error ? e.message : "Failed to load credit note.",
          );
          toastRef.current({
            title: "Failed to load credit note",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      profilePromise
        .then((prof) => {
          if (!cancelled) setProfile(prof);
        })
        .catch(() => {
          if (!cancelled) setProfile(null);
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  const totals = useMemo(
    () => (creditNote ? computeCreditNoteTotals(creditNote) : null),
    [creditNote],
  );

  const display = useMemo(() => {
    if (!creditNote || !totals) return null;
    const bill = (creditNote.bill_to_snapshot || {}) as Record<string, unknown>;
    const billName =
      bill.type === "company"
        ? String(bill.company_name ?? "")
        : String(bill.full_name ?? "");
    return { bill, billName };
  }, [creditNote, totals]);

  const moneyFmt = useMemo(
    () =>
      creditNote
        ? (amt: number) => formatMoney(amt, creditNote.currency)
        : null,
    [creditNote],
  );

  if (!loading && !creditNote) {
    return (
      <AppPageShell
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={
          <Button variant="ghost" size="icon" asChild aria-label="Back">
            <Link href="/app/credit-notes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
        subtitle="We couldn't find that credit note."
      >
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">Credit note not found</h2>
          {error ? (
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          ) : null}
          <Button asChild className="mt-6">
            <Link href="/app/credit-notes">Back to credit notes</Link>
          </Button>
        </div>
      </AppPageShell>
    );
  }

  if (loading || !creditNote) {
    return (
      <AppPageShell
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={
          <Button variant="ghost" size="icon" asChild aria-label="Back">
            <Link href="/app/credit-notes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
        subtitle="Loading credit note…"
      >
        <DetailDocumentPageSkeleton />
      </AppPageShell>
    );
  }

  const { subtotal, taxTotal, discount, total } = totals!;
  const { bill, billName } = display!;
  const from = creditNote.from_snapshot || {};
  const safeProfile = {
    accountType: profile?.accountType ?? "individual",
    companyName: profile?.companyName ?? "",
    fullName: profile?.fullName ?? "",
    email: profile?.email ?? "",
    logoUrl: (profile as { logoUrl?: string })?.logoUrl,
  };
  const fromName =
    from?.type === "company"
      ? String(from?.company_name ?? "")
      : String(from?.full_name ?? "") ||
        (safeProfile.accountType === "company"
          ? safeProfile.companyName
          : safeProfile.fullName);
  const fromEmail = String(from?.email ?? "") || safeProfile.email;
  const logoSrc =
    String((from as { logoUrl?: string }).logoUrl ?? "") ||
    safeProfile.logoUrl ||
    "/kredence.png";

  return (
    <AppPageShell
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link href="/app/credit-notes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      belowSubtitle={
        <CreditNoteViewActions
          creditNoteId={creditNote.id}
          creditNote={creditNote}
          profile={profile}
          logoSrc={logoSrc}
          onStatusChange={(status) => {
            setCreditNote((prev) => (prev ? { ...prev, status } : prev));
          }}
          onRefresh={() => setRefreshKey((n) => n + 1)}
        />
      }
    >
      <div className="h-auto w-full rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <Card className="border-0 shadow-none">
          <CardContent className="space-y-6 p-0 sm:space-y-8">
            <div className="flex items-start justify-between">
              <div>
                {logoSrc ? (
                  <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-muted">
                    <Image
                      src={logoSrc}
                      alt="Sender logo"
                      width={48}
                      height={48}
                      className="object-contain"
                      priority
                    />
                  </div>
                ) : null}
                <h2 className="text-xl font-bold">{fromName}</h2>
                {fromEmail ? (
                  <p className="mt-1 text-sm text-muted-foreground">{fromEmail}</p>
                ) : null}
              </div>
              <div className="text-right">
                <h3 className="text-2xl font-bold text-muted-foreground">
                  CREDIT NOTE
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {creditNote.number}
                </p>
              </div>
            </div>

            <Separator />

            <CompactBillToSummary billName={billName} bill={bill} />

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Issue date
                </p>
                <p className="font-medium">{formatDate(creditNote.issue_date)}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Status
                </p>
                <div className="mt-1">
                  <CreditNoteStatusBadge status={creditNote.status} />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Credit type
                </p>
                <p className="font-medium capitalize">{creditNote.credit_type}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Reason
                </p>
                <p className="font-medium">
                  {creditNoteReasonLabel(creditNote.reason)}
                </p>
              </div>
            </div>

            {creditNote.status === "posted" ? (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
                This credit note is posted and read-only. Invoice balance was reduced when posted.
              </p>
            ) : null}

            {creditNote.related_invoice_id ? (
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Related invoice
                </p>
                <Link
                  href={`/app/invoices/${creditNote.related_invoice_id}`}
                  className="mt-1 inline-block text-sm font-medium text-primary underline"
                >
                  {creditNote.relatedInvoiceNumber || "View invoice"}
                </Link>
              </div>
            ) : null}

            <Separator />

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 text-left text-sm font-semibold text-muted-foreground">
                      Item
                    </th>
                    <th className="py-3 text-left text-sm font-semibold text-muted-foreground">
                      Description
                    </th>
                    <th className="py-3 text-right text-sm font-semibold text-muted-foreground">
                      Qty
                    </th>
                    <th className="py-3 text-right text-sm font-semibold text-muted-foreground">
                      Price
                    </th>
                    <th className="py-3 text-right text-sm font-semibold text-muted-foreground">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {creditNote.items.map((it, idx) => (
                    <CreditNoteLineRow
                      key={idx}
                      item={it}
                      formatMoney={moneyFmt!}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{moneyFmt!(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{moneyFmt!(taxTotal)}</span>
                </div>
                {discount > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span>-{moneyFmt!(discount)}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Credit total</span>
                  <span>{moneyFmt!(total)}</span>
                </div>
              </div>
            </div>

            {(creditNote.notes || creditNote.terms) && (
              <>
                <Separator />
                <div className="space-y-4">
                  {creditNote.notes ? (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                        NOTES
                      </h4>
                      <p className="text-sm">{creditNote.notes}</p>
                    </div>
                  ) : null}
                  {creditNote.terms ? (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                        TERMS
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {creditNote.terms}
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppPageShell>
  );
}

function CreditNoteLineRow({
  item,
  formatMoney,
}: {
  item: CreditNoteItemRow;
  formatMoney: (amt: number) => string;
}) {
  const line = Number(item.quantity) * Number(item.unit_price);
  const taxAmt = line * (Number(item.tax_percent) / 100);
  const lineTotal = line + taxAmt;
  return (
    <tr className="border-b">
      <td className="py-4 font-medium">{item.item}</td>
      <td className="py-4 text-sm text-muted-foreground">
        {item.description || ""}
      </td>
      <td className="py-4 text-right">{item.quantity}</td>
      <td className="py-4 text-right">{formatMoney(Number(item.unit_price))}</td>
      <td className="py-4 text-right font-medium">{formatMoney(lineTotal)}</td>
    </tr>
  );
}
