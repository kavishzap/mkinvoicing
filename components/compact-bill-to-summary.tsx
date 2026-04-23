/** Compact “bill to” line for document view pages (replaces a full-width address block). */
export function CompactBillToSummary({
  billName,
  bill,
}: {
  billName: string | undefined | null;
  bill: Record<string, unknown>;
}) {
  const email = bill.email != null ? String(bill.email).trim() : "";
  const phone = bill.phone != null ? String(bill.phone).trim() : "";
  const street = bill.street != null ? String(bill.street).trim() : "";
  const city = bill.city != null ? String(bill.city).trim() : "";
  const postal = bill.postal != null ? String(bill.postal).trim() : "";
  const country = bill.country != null ? String(bill.country).trim() : "";
  const cityLine = [city, postal].filter(Boolean).join(", ");
  const addrTail = [cityLine, country].filter(Boolean).join(" · ");
  const addr = [street, addrTail].filter(Boolean).join(" · ");

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm sm:px-4">
      <p className="leading-snug text-foreground">
        <span className="font-medium text-muted-foreground">Bill to </span>
        <span className="font-semibold">{billName?.trim() || "—"}</span>
        {email ? (
          <span className="text-muted-foreground"> · {email}</span>
        ) : null}
        {phone ? (
          <span className="text-muted-foreground"> · {phone}</span>
        ) : null}
      </p>
      {addr ? (
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{addr}</p>
      ) : null}
    </div>
  );
}
