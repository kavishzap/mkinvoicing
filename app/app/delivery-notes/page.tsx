"use client";

import { AppPageShell } from "@/components/app-page-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DeliveryNotesPage() {
  return (
    <AppPageShell subtitle="Create and track delivery documents for your shipments.">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery notes</CardTitle>
          <CardDescription>
            This module is ready for listing, printing, and linking to sales
            orders. Grant the{" "}
            <span className="font-mono text-foreground">delivery_note</span>{" "}
            feature to roles that should see it in the sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use <span className="font-mono text-foreground">public.features</span>{" "}
          with code <span className="font-mono text-foreground">delivery_note</span>,
          then attach it to the relevant company roles.
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
