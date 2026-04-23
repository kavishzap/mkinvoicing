"use client";

import { useMemo, useRef, useState } from "react";
import { Boxes, Users } from "lucide-react";
import { AppPageShell } from "@/components/app-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  addCustomersBulk,
  customerPayloadImportDedupeKey,
  getExistingCustomerImportDedupeKeys,
  type CustomerPayload,
} from "@/lib/customers-service";
import {
  addProductsBulk,
  getExistingProductImportDedupeKeys,
  productImportNameDedupeKey,
  productImportSkuDedupeKey,
  type ProductPayload,
} from "@/lib/products-service";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

const PREVIEW_MAX_ROWS = 100;

type ImportRow = Record<string, unknown>;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/_/g, " ");
}

function firstValue(row: ImportRow, names: string[]): string {
  const normalizedNames = names.map(normalizeHeader);
  for (const [key, raw] of Object.entries(row)) {
    const nk = normalizeHeader(key);
    if (!normalizedNames.includes(nk)) continue;
    const out = String(raw ?? "").trim();
    if (out) return out;
  }
  return "";
}

async function readRowsFromFile(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: "" });
}

function downloadBlankTemplate(filename: string, headers: string[]) {
  const escapeCell = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
  const csv = `${headers.map(escapeCell).join(",")}\r\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Non-empty type cell must be exactly these (case-insensitive). */
function invalidCustomerTypeMessage(row: ImportRow, rowIndex0: number): string | null {
  const raw = firstValue(row, ["type", "customer type"]);
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "individual" || t === "company") return null;
  const sheetRow = rowIndex0 + 2;
  return `Row ${sheetRow}: Type must be "individual" or "company". Found "${raw}".`;
}

function mapCustomerRow(row: ImportRow): CustomerPayload | null {
  const rawType = firstValue(row, ["type", "customer type"]);
  const explicit: "individual" | "company" | null = rawType
    ? rawType.trim().toLowerCase() === "individual"
      ? "individual"
      : rawType.trim().toLowerCase() === "company"
        ? "company"
        : null
    : null;

  const companyName = firstValue(row, ["company name", "company_name"]);
  const contactName = firstValue(row, ["contact name", "contact_name"]);
  const fullName = firstValue(row, ["full name", "fullname", "full_name"]);
  const email = firstValue(row, ["email"]);
  const phone = firstValue(row, ["phone", "mobile"]);
  const address1 = firstValue(row, ["address line 1", "address_line_1"]);
  const address2 = firstValue(row, ["address line 2", "address_line_2"]);

  const kind: "company" | "individual" = explicit ?? (companyName ? "company" : "individual");

  if (kind === "company") {
    if (!companyName || !phone) return null;
    return {
      type: "company",
      companyName,
      contactName: contactName || undefined,
      email: email || "",
      phone,
      address_line_1: address1 || undefined,
      address_line_2: address2 || undefined,
      isActive: true,
    };
  }
  if (!fullName || !phone) return null;
  return {
    type: "individual",
    fullName,
    email: email || "",
    phone,
    address_line_1: address1 || undefined,
    address_line_2: address2 || undefined,
    isActive: true,
  };
}

type CustomerImportBuildResult =
  | { ok: true; payloads: CustomerPayload[]; skipped: number }
  | { ok: false; error: string };

function buildCustomerImport(rows: ImportRow[]): CustomerImportBuildResult {
  for (let i = 0; i < rows.length; i++) {
    const msg = invalidCustomerTypeMessage(rows[i]!, i);
    if (msg) return { ok: false, error: msg };
  }
  const payloads: CustomerPayload[] = [];
  let skipped = 0;
  for (const row of rows) {
    const p = mapCustomerRow(row);
    if (p) payloads.push(p);
    else skipped++;
  }
  return { ok: true, payloads, skipped };
}

/** Within this import only: same full_name (individual) or company_name (company) after normalize. */
function duplicateCustomerRowFlags(payloads: CustomerPayload[]): boolean[] {
  const keys = payloads.map((p) => customerPayloadImportDedupeKey(p));
  const counts = new Map<string, number>();
  for (const k of keys) {
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return keys.map((k) => (k ? (counts.get(k) ?? 0) > 1 : false));
}

function mapProductRow(row: ImportRow): ProductPayload | null {
  const name = firstValue(row, ["name", "product name"]);
  if (!name) return null;
  const sku = firstValue(row, ["sku"]);
  const costRaw = firstValue(row, ["cost price", "cost_price"]);
  const saleRaw = firstValue(row, ["sale price", "sale_price"]);
  const cost = parseFloat(costRaw || "0");
  const sale = parseFloat(saleRaw || "0");
  return {
    name,
    sku: sku || null,
    costPrice: Number.isNaN(cost) ? 0 : cost,
    salePrice: Number.isNaN(sale) ? 0 : sale,
    unit: "pcs",
    currency: "MUR",
    is_active: true,
  };
}

function buildProductImport(rows: ImportRow[]): { payloads: ProductPayload[]; skipped: number } {
  const payloads: ProductPayload[] = [];
  let skipped = 0;
  for (const row of rows) {
    const p = mapProductRow(row);
    if (p) payloads.push(p);
    else skipped++;
  }
  return { payloads, skipped };
}

type ProductDupCell = { any: boolean; name: boolean; sku: boolean };

function productImportFileDuplicateDetails(payloads: ProductPayload[]): ProductDupCell[] {
  const nameCounts = new Map<string, number>();
  const skuCounts = new Map<string, number>();
  for (const p of payloads) {
    const nk = productImportNameDedupeKey(p.name);
    if (nk) nameCounts.set(nk, (nameCounts.get(nk) ?? 0) + 1);
    const sk = productImportSkuDedupeKey(p.sku);
    if (sk) skuCounts.set(sk, (skuCounts.get(sk) ?? 0) + 1);
  }
  return payloads.map((p) => {
    const nk = productImportNameDedupeKey(p.name);
    const sk = productImportSkuDedupeKey(p.sku);
    const name = nk ? (nameCounts.get(nk) ?? 0) > 1 : false;
    const sku = sk ? (skuCounts.get(sk) ?? 0) > 1 : false;
    return { any: name || sku, name, sku };
  });
}

function productImportDbDuplicateDetails(
  payloads: ProductPayload[],
  existing: Set<string>,
): ProductDupCell[] {
  return payloads.map((p) => {
    const nk = productImportNameDedupeKey(p.name);
    const sk = productImportSkuDedupeKey(p.sku);
    const name = nk ? existing.has(nk) : false;
    const sku = sk ? existing.has(sk) : false;
    return { any: name || sku, name, sku };
  });
}

export default function DataCenterPage() {
  const { toast } = useToast();
  const customerInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  const [customerPreview, setCustomerPreview] = useState<CustomerPayload[] | null>(null);
  const [customerSkipped, setCustomerSkipped] = useState(0);
  const [customerTypeError, setCustomerTypeError] = useState<string | null>(null);
  const [customerParsing, setCustomerParsing] = useState(false);
  const [customerImporting, setCustomerImporting] = useState(false);
  /** Per preview row: matches an existing customer in DB (same type + normalized name). */
  const [customerDbDuplicateFlags, setCustomerDbDuplicateFlags] = useState<boolean[]>([]);

  const [productPreview, setProductPreview] = useState<ProductPayload[] | null>(null);
  const [productSkipped, setProductSkipped] = useState(0);
  const [productParsing, setProductParsing] = useState(false);
  const [productImporting, setProductImporting] = useState(false);
  const [productDbDupDetails, setProductDbDupDetails] = useState<ProductDupCell[]>([]);

  async function onCustomerFileSelected(file: File | null) {
    setCustomerPreview(null);
    setCustomerSkipped(0);
    setCustomerTypeError(null);
    setCustomerDbDuplicateFlags([]);
    setProductPreview(null);
    setProductSkipped(0);
    setProductDbDupDetails([]);
    if (!file) return;
    try {
      setCustomerParsing(true);
      const rows = await readRowsFromFile(file);
      const built = buildCustomerImport(rows);
      if (!built.ok) {
        setCustomerTypeError(built.error);
        toast({
          title: "Invalid customer type",
          description: built.error,
          variant: "destructive",
        });
        if (customerInputRef.current) customerInputRef.current.value = "";
        return;
      }
      const { payloads, skipped } = built;
      let dbDup: boolean[] = [];
      if (payloads.length > 0) {
        const existingKeys = await getExistingCustomerImportDedupeKeys();
        dbDup = payloads.map((p) => {
          const k = customerPayloadImportDedupeKey(p);
          return !!(k && existingKeys.has(k));
        });
      }
      setCustomerPreview(payloads);
      setCustomerSkipped(skipped);
      setCustomerDbDuplicateFlags(dbDup);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Could not read file", description: msg, variant: "destructive" });
      if (customerInputRef.current) customerInputRef.current.value = "";
    } finally {
      setCustomerParsing(false);
    }
  }

  async function onProductFileSelected(file: File | null) {
    setProductPreview(null);
    setProductSkipped(0);
    setProductDbDupDetails([]);
    setCustomerPreview(null);
    setCustomerSkipped(0);
    setCustomerTypeError(null);
    setCustomerDbDuplicateFlags([]);
    if (!file) return;
    try {
      setProductParsing(true);
      const rows = await readRowsFromFile(file);
      const { payloads, skipped } = buildProductImport(rows);
      let dbDetails: ProductDupCell[] = [];
      if (payloads.length > 0) {
        const existingKeys = await getExistingProductImportDedupeKeys();
        dbDetails = productImportDbDuplicateDetails(payloads, existingKeys);
      }
      setProductPreview(payloads);
      setProductSkipped(skipped);
      setProductDbDupDetails(dbDetails);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Could not read file", description: msg, variant: "destructive" });
      if (productInputRef.current) productInputRef.current.value = "";
    } finally {
      setProductParsing(false);
    }
  }

  function clearCustomerPreview() {
    setCustomerPreview(null);
    setCustomerSkipped(0);
    setCustomerTypeError(null);
    setCustomerDbDuplicateFlags([]);
    if (customerInputRef.current) customerInputRef.current.value = "";
  }

  function clearProductPreview() {
    setProductPreview(null);
    setProductSkipped(0);
    setProductDbDupDetails([]);
    if (productInputRef.current) productInputRef.current.value = "";
  }

  async function confirmCustomerImport() {
    if (customerTypeError) {
      toast({ title: "Fix file errors first", description: customerTypeError, variant: "destructive" });
      return;
    }
    if (customerPreview && duplicateCustomerRowFlags(customerPreview).some(Boolean)) {
      toast({
        title: "Duplicate names in file",
        description:
          "Remove or merge rows with the same full_name (individual) or company_name (company), then upload again.",
        variant: "destructive",
      });
      return;
    }
    if (customerPreview && customerDbDuplicateFlags.some(Boolean)) {
      toast({
        title: "Customers already exist",
        description:
          "Some rows match customers already in your account (same type and name). Remove those rows or use a different file.",
        variant: "destructive",
      });
      return;
    }
    if (!customerPreview?.length) {
      toast({ title: "Nothing to import", variant: "destructive" });
      return;
    }
    try {
      setCustomerImporting(true);
      const res = await addCustomersBulk(customerPreview);
      toast({
        title: "Customer import complete",
        description: `Inserted ${res.inserted} customer(s).`,
      });
      clearCustomerPreview();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Customer import failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setCustomerImporting(false);
    }
  }

  async function confirmProductImport() {
    if (productPreview && productImportFileDuplicateDetails(productPreview).some((d) => d.any)) {
      toast({
        title: "Duplicate products in file",
        description:
          "Remove or fix rows that share the same name, or the same SKU when SKU is filled, then upload again.",
        variant: "destructive",
      });
      return;
    }
    if (productPreview && productDbDupDetails.some((d) => d.any)) {
      toast({
        title: "Products already exist",
        description:
          "Some rows match existing products (same normalized name or same SKU). Remove those rows or change the file.",
        variant: "destructive",
      });
      return;
    }
    if (!productPreview?.length) {
      toast({ title: "Nothing to import", variant: "destructive" });
      return;
    }
    try {
      setProductImporting(true);
      const res = await addProductsBulk(productPreview);
      toast({
        title: "Product import complete",
        description: `Inserted ${res.inserted} product(s).`,
      });
      clearProductPreview();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Product import failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setProductImporting(false);
    }
  }

  const customerFileDuplicateFlags = useMemo(
    () => (customerPreview ? duplicateCustomerRowFlags(customerPreview) : []),
    [customerPreview],
  );
  const customerHasFileDuplicates = customerFileDuplicateFlags.some(Boolean);
  const customerHasDbDuplicates = customerDbDuplicateFlags.some(Boolean);

  const customerRowConflictFlags = useMemo(() => {
    if (!customerPreview?.length) return [];
    return customerPreview.map(
      (_, i) =>
        Boolean(customerFileDuplicateFlags[i]) || Boolean(customerDbDuplicateFlags[i]),
    );
  }, [customerPreview, customerFileDuplicateFlags, customerDbDuplicateFlags]);

  const customerHasBlockingDuplicates = customerRowConflictFlags.some(Boolean);

  const dbDuplicateNameSummary = useMemo(() => {
    if (!customerPreview?.length || !customerDbDuplicateFlags.length) return "";
    const labels: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < customerPreview.length; i++) {
      if (!customerDbDuplicateFlags[i]) continue;
      const p = customerPreview[i]!;
      const key = customerPayloadImportDedupeKey(p) ?? `row-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const name =
        p.type === "company" ? (p.companyName?.trim() || "Company") : (p.fullName?.trim() || "Individual");
      labels.push(`${name} (${p.type})`);
    }
    const max = 24;
    const shown = labels.slice(0, max);
    const suffix = labels.length > max ? ` …and ${labels.length - max} more` : "";
    return shown.join(", ") + suffix;
  }, [customerPreview, customerDbDuplicateFlags]);

  const customerPreviewRows = customerPreview?.slice(0, PREVIEW_MAX_ROWS) ?? [];
  const customerDuplicateFlagsPreview = customerRowConflictFlags.slice(0, PREVIEW_MAX_ROWS);
  const customerExtra =
    customerPreview && customerPreview.length > PREVIEW_MAX_ROWS
      ? customerPreview.length - PREVIEW_MAX_ROWS
      : 0;

  const productPreviewRows = productPreview?.slice(0, PREVIEW_MAX_ROWS) ?? [];
  const productExtra =
    productPreview && productPreview.length > PREVIEW_MAX_ROWS
      ? productPreview.length - PREVIEW_MAX_ROWS
      : 0;

  const productFileDupDetails = useMemo(
    () => (productPreview ? productImportFileDuplicateDetails(productPreview) : []),
    [productPreview],
  );
  const productHasFileDuplicates = productFileDupDetails.some((d) => d.any);
  const productHasDbDuplicates = productDbDupDetails.some((d) => d.any);

  const productRowConflicts = useMemo(() => {
    if (!productPreview?.length) return [];
    return productPreview.map((_, i) => {
      const f = productFileDupDetails[i];
      const d = productDbDupDetails[i];
      return {
        any: Boolean(f?.any) || Boolean(d?.any),
        name: Boolean(f?.name) || Boolean(d?.name),
        sku: Boolean(f?.sku) || Boolean(d?.sku),
      };
    });
  }, [productPreview, productFileDupDetails, productDbDupDetails]);

  const productHasBlockingDuplicates = productRowConflicts.some((c) => c.any);

  const productDbConflictSummary = useMemo(() => {
    if (!productPreview?.length || !productDbDupDetails.length) return "";
    const labels: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < productPreview.length; i++) {
      const d = productDbDupDetails[i];
      if (!d?.any) continue;
      const p = productPreview[i]!;
      const key = `${productImportNameDedupeKey(p.name) ?? ""}|${productImportSkuDedupeKey(p.sku) ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bits: string[] = [];
      if (d.name) bits.push(`name “${p.name.trim()}”`);
      if (d.sku && String(p.sku ?? "").trim()) bits.push(`sku “${String(p.sku).trim()}”`);
      labels.push(bits.join(", "));
    }
    const max = 24;
    const shown = labels.slice(0, max);
    const suffix = labels.length > max ? ` …and ${labels.length - max} more` : "";
    return shown.join("; ") + suffix;
  }, [productPreview, productDbDupDetails]);

  const productRowConflictsPreview = productRowConflicts.slice(0, PREVIEW_MAX_ROWS);

  return (
    <AppPageShell subtitle="Bulk import customers and products from your template files.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Customer Import
            </CardTitle>
            <CardDescription>
              Choose a file to open a preview in a dialog, then confirm to import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              ref={customerInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={customerParsing}
              onChange={(e) => void onCustomerFileSelected(e.target.files?.[0] ?? null)}
            />
            {customerParsing ? (
              <p className="text-sm text-muted-foreground">Reading file…</p>
            ) : null}
            {customerTypeError ? (
              <Alert variant="destructive">
                <AlertTitle>Cannot import this file</AlertTitle>
                <AlertDescription>{customerTypeError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Boxes className="h-4 w-4" />
              Product Import
            </CardTitle>
            <CardDescription>
              Choose a file to open a preview in a dialog, then confirm to import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              ref={productInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={productParsing}
              onChange={(e) => void onProductFileSelected(e.target.files?.[0] ?? null)}
            />
            {productParsing ? <p className="text-sm text-muted-foreground">Reading file…</p> : null}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={customerPreview !== null}
        onOpenChange={(open) => {
          if (!open) clearCustomerPreview();
        }}
      >
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-4 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Customer import preview</DialogTitle>
            <DialogDescription>
              {customerPreview !== null ? (
                <>
                  <span className="font-medium text-foreground">{customerPreview.length}</span> to import
                  {customerSkipped > 0 ? (
                    <>
                      {" "}
                      · <span className="font-medium text-foreground">{customerSkipped}</span> skipped
                    </>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {customerHasFileDuplicates ? (
            <Alert variant="destructive">
              <AlertTitle>Duplicate names in this file</AlertTitle>
              <AlertDescription>
                Rows that share the same <span className="font-medium">full_name</span> (individual) or{" "}
                <span className="font-medium">company_name</span> (company) are highlighted. Fix the spreadsheet
                and upload again — import stays disabled until duplicates are gone.
              </AlertDescription>
            </Alert>
          ) : null}
          {customerHasDbDuplicates ? (
            <Alert variant="destructive">
              <AlertTitle>Already in your customer list</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Highlighted rows match an existing customer (same{" "}
                  <span className="font-medium">type</span> +{" "}
                  <span className="font-medium">full_name</span> or{" "}
                  <span className="font-medium">company_name</span> after normalizing spaces and case). Remove
                  those rows from the file to import the rest, or change the names in the sheet.
                </p>
                {dbDuplicateNameSummary ? (
                  <p className="font-medium text-foreground">Conflicts: {dbDuplicateNameSummary}</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-background text-xs">
            <table className="w-full min-w-[520px] text-left">
              <thead className="sticky top-0 z-10 bg-muted/80 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">type</th>
                  <th className="px-2 py-1.5 font-medium">full_name</th>
                  <th className="px-2 py-1.5 font-medium">company_name</th>
                  <th className="px-2 py-1.5 font-medium">contact_name</th>
                  <th className="px-2 py-1.5 font-medium">email</th>
                  <th className="px-2 py-1.5 font-medium">phone</th>
                  <th className="px-2 py-1.5 font-medium">address_line_1</th>
                  <th className="px-2 py-1.5 font-medium">address_line_2</th>
                </tr>
              </thead>
              <tbody>
                {customerPreviewRows.map((p, i) => {
                  const dup = customerDuplicateFlagsPreview[i] ?? false;
                  return (
                    <tr
                      key={i}
                      className={cn("border-t", dup && "bg-destructive/10 text-destructive")}
                    >
                      <td className={cn("px-2 py-1.5", dup && "font-medium")}>{p.type}</td>
                      <td
                        className={cn(
                          "px-2 py-1.5",
                          dup && p.type === "individual" && "font-semibold text-destructive",
                        )}
                      >
                        {p.fullName ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1.5",
                          dup && p.type === "company" && "font-semibold text-destructive",
                        )}
                      >
                        {p.companyName ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">{p.contactName ?? "—"}</td>
                      <td className="px-2 py-1.5">{p.email || "—"}</td>
                      <td className="px-2 py-1.5">{p.phone ?? "—"}</td>
                      <td className="px-2 py-1.5">{p.address_line_1 ?? "—"}</td>
                      <td className="px-2 py-1.5">{p.address_line_2 ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {customerExtra > 0 ? (
            <p className="text-xs text-muted-foreground">
              Showing first {PREVIEW_MAX_ROWS} rows · {customerExtra} more not shown
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={clearCustomerPreview} disabled={customerImporting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmCustomerImport()}
              disabled={customerImporting || !customerPreview?.length || customerHasBlockingDuplicates}
            >
              {customerImporting ? "Importing…" : "Confirm import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={productPreview !== null}
        onOpenChange={(open) => {
          if (!open) clearProductPreview();
        }}
      >
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-4 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Product import preview</DialogTitle>
            <DialogDescription>
              {productPreview !== null ? (
                <>
                  <span className="font-medium text-foreground">{productPreview.length}</span> to import
                  {productSkipped > 0 ? (
                    <>
                      {" "}
                      · <span className="font-medium text-foreground">{productSkipped}</span> skipped
                    </>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {productHasFileDuplicates ? (
            <Alert variant="destructive">
              <AlertTitle>Duplicate products in this file</AlertTitle>
              <AlertDescription>
                Rows that share the same normalized <span className="font-medium">name</span>, or the same{" "}
                <span className="font-medium">sku</span> when SKU is filled, are highlighted. Fix the spreadsheet
                and upload again — import stays disabled until duplicates are gone.
              </AlertDescription>
            </Alert>
          ) : null}
          {productHasDbDuplicates ? (
            <Alert variant="destructive">
              <AlertTitle>Already in your product list</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Highlighted rows match an existing product (same normalized name, or same SKU when both have a
                  SKU). Remove those rows from the file or change name/SKU before importing.
                </p>
                {productDbConflictSummary ? (
                  <p className="font-medium text-foreground">Conflicts: {productDbConflictSummary}</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-background text-xs">
            <table className="w-full min-w-[360px] text-left">
              <thead className="sticky top-0 z-10 bg-muted/80 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">name</th>
                  <th className="px-2 py-1.5 font-medium">sku</th>
                  <th className="px-2 py-1.5 font-medium text-right">cost_price</th>
                  <th className="px-2 py-1.5 font-medium text-right">sale_price</th>
                </tr>
              </thead>
              <tbody>
                {productPreviewRows.map((p, i) => {
                  const c = productRowConflictsPreview[i] ?? { any: false, name: false, sku: false };
                  return (
                    <tr
                      key={i}
                      className={cn("border-t", c.any && "bg-destructive/10 text-destructive")}
                    >
                      <td className={cn("px-2 py-1.5", c.name && "font-semibold text-destructive")}>{p.name}</td>
                      <td className={cn("px-2 py-1.5", c.sku && "font-semibold text-destructive")}>
                        {p.sku ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{p.costPrice ?? 0}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{p.salePrice ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {productExtra > 0 ? (
            <p className="text-xs text-muted-foreground">
              Showing first {PREVIEW_MAX_ROWS} rows · {productExtra} more not shown
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={clearProductPreview} disabled={productImporting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmProductImport()}
              disabled={productImporting || !productPreview?.length || productHasBlockingDuplicates}
            >
              {productImporting ? "Importing…" : "Confirm import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border bg-muted/30 p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">Customer Import Sample Format</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadBlankTemplate("customer-import-template.csv", [
                "type",
                "full_name",
                "company_name",
                "contact_name",
                "email",
                "phone",
                "address_line_1",
                "address_line_2",
              ])
            }
          >
            Download blank template
          </Button>
        </div>
        <div className="mt-2 overflow-x-auto rounded border bg-background">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">type</th>
                <th className="px-2 py-1.5 font-medium">full_name</th>
                <th className="px-2 py-1.5 font-medium">company_name</th>
                <th className="px-2 py-1.5 font-medium">contact_name</th>
                <th className="px-2 py-1.5 font-medium">email</th>
                <th className="px-2 py-1.5 font-medium">phone</th>
                <th className="px-2 py-1.5 font-medium">address_line_1</th>
                <th className="px-2 py-1.5 font-medium">address_line_2</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-2 py-1.5">individual</td>
                <td className="px-2 py-1.5">John Doe</td>
                <td className="px-2 py-1.5"> </td>
                <td className="px-2 py-1.5"> </td>
                <td className="px-2 py-1.5">john@example.com</td>
                <td className="px-2 py-1.5">+2301234567</td>
                <td className="px-2 py-1.5">12 Green Road</td>
                <td className="px-2 py-1.5">Suite 3</td>
              </tr>
              <tr className="border-t">
                <td className="px-2 py-1.5">company</td>
                <td className="px-2 py-1.5"> </td>
                <td className="px-2 py-1.5">Acme Ltd</td>
                <td className="px-2 py-1.5">Jane Smith</td>
                <td className="px-2 py-1.5">sales@acme.com</td>
                <td className="px-2 py-1.5">+2309876543</td>
                <td className="px-2 py-1.5">45 Business Ave</td>
                <td className="px-2 py-1.5">Level 2</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-muted-foreground">
          If you use the <span className="text-foreground">Type</span> column, each value must be{" "}
          <span className="text-foreground">individual</span> or <span className="text-foreground">company</span>{" "}
          (any other value blocks the import). Leave Type empty to infer from company name vs person fields.
        </p>
        <p className="mt-1 text-muted-foreground">
          Mandatory: individual = <span className="text-foreground">full name + phone</span>,
          company = <span className="text-foreground">company name + phone</span>.
        </p>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">Product Import Sample Format</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadBlankTemplate("product-import-template.csv", [
                "name",
                "sku",
                "cost_price",
                "sale_price",
              ])
            }
          >
            Download blank template
          </Button>
        </div>
        <div className="mt-2 overflow-x-auto rounded border bg-background">
          <table className="w-full min-w-[420px] text-left">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">name</th>
                <th className="px-2 py-1.5 font-medium">sku</th>
                <th className="px-2 py-1.5 font-medium">cost_price</th>
                <th className="px-2 py-1.5 font-medium">sale_price</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-2 py-1.5">Widget A</td>
                <td className="px-2 py-1.5">WGT-001</td>
                <td className="px-2 py-1.5">120.50</td>
                <td className="px-2 py-1.5">175.00</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-muted-foreground">
          Mandatory: <span className="text-foreground">name</span>.
        </p>
        <p className="mt-1 text-muted-foreground">
          Preview blocks import if the file repeats the same normalized <span className="text-foreground">name</span>{" "}
          or <span className="text-foreground">sku</span> (when filled), or if a row matches a product already saved
          for your company.
        </p>
      </div>
    </AppPageShell>
  );
}
