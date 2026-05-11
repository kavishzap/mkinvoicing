"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCustomer, type CustomerRow } from "@/lib/customers-service";
import { cn } from "@/lib/utils";

type CustomerInfoDialogProps = {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function InfoLine({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 break-words text-sm text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

function buildAddressLines(c: CustomerRow): string[] {
  const lines: string[] = [];
  const street = (c.street ?? "").trim();
  const a1 = (c.address_line_1 ?? "").trim();
  const a2 = (c.address_line_2 ?? "").trim();
  if (street) lines.push(street);
  if (a1) lines.push(a1);
  if (a2) lines.push(a2);
  const cityName = (c.cityName ?? c.city ?? "").trim();
  const postal = (c.postal ?? "").trim();
  const cityLine = [cityName, postal].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  const country = (c.country ?? "").trim();
  if (country) lines.push(country);
  return lines;
}

export function CustomerInfoDialog({
  customerId,
  open,
  onOpenChange,
}: CustomerInfoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);

  useEffect(() => {
    if (!open || !customerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCustomer(null);
    (async () => {
      try {
        const c = await getCustomer(customerId);
        if (cancelled) return;
        if (!c) {
          setError("Customer not found or you don't have access.");
        } else {
          setCustomer(c);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load customer.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  const isCompany = customer?.type === "company";
  const Icon = isCompany ? Building2 : UserRound;
  const displayName = customer
    ? (isCompany
        ? customer.companyName?.trim() || customer.contactName?.trim()
        : customer.fullName?.trim()) || "Customer"
    : "Customer";

  const addressLines = customer ? buildAddressLines(customer) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/60">
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
            </span>
            <span className="min-w-0 truncate">{displayName}</span>
          </DialogTitle>
          <DialogDescription>
            Customer details from your directory.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-5 w-3/5 animate-pulse rounded bg-muted" />
          </div>
        ) : error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : customer ? (
          <div className="space-y-3 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {customer.type}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  customer.isActive === false
                    ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                    : "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
                )}
              >
                {customer.isActive === false ? "Inactive" : "Active"}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-3">
              {isCompany && customer.contactName ? (
                <InfoLine icon={UserRound} label="Contact">
                  {customer.contactName}
                </InfoLine>
              ) : null}

              {customer.email ? (
                <InfoLine icon={Mail} label="Email">
                  <a
                    href={`mailto:${customer.email}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {customer.email}
                  </a>
                </InfoLine>
              ) : null}

              {customer.phone ? (
                <InfoLine icon={Phone} label="Phone">
                  <a
                    href={`tel:${customer.phone}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {customer.phone}
                  </a>
                </InfoLine>
              ) : null}

              {addressLines.length > 0 ? (
                <InfoLine icon={MapPin} label="Address">
                  <span className="block whitespace-pre-line leading-relaxed">
                    {addressLines.join("\n")}
                  </span>
                </InfoLine>
              ) : null}

              {!customer.email &&
              !customer.phone &&
              addressLines.length === 0 &&
              !(isCompany && customer.contactName) ? (
                <p className="text-sm text-muted-foreground">
                  No additional contact details on file.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {customer ? (
            <Button asChild className="gap-2">
              <Link href={`/app/customers/${customer.id}/edit`}>
                <ExternalLink className="h-4 w-4" aria-hidden />
                Open customer record
              </Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
