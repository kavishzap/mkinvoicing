"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Plus, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  listDeliveries,
  type DeliveryListRow,
} from "@/lib/deliveries-service";

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

export default function DeliveryNotesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<DeliveryListRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const list = await listDeliveries();
        if (!cancelled) setRows(list);
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

  return (
    <AppPageShell
      subtitle="Assign drivers to sales orders that are still New on fulfillment. Eligible orders leave this list once you save a delivery."
      actions={
        <Button asChild size="sm" className="gap-2">
          <Link href="/app/delivery-notes/new">
            <Plus className="h-4 w-4" />
            New delivery
          </Link>
        </Button>
      }
    >
      <Card>
        <CardContent className="p-0 sm:p-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead className="w-[120px] text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
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
                  rows.map((r) => (
                    <TableRow key={r.id}>
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
                      <TableCell className="text-muted-foreground text-sm">
                        {r.createdByDisplay}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="gap-1.5" asChild>
                          <Link href={`/app/delivery-notes/${r.id}`}>
                            <Eye className="h-4 w-4" aria-hidden />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
