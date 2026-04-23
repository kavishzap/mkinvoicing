"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getDelivery,
  type DeliveryDetail,
} from "@/lib/deliveries-service";
import { renderDeliveryNotePdf } from "@/lib/delivery-note-pdf";

type Props = {
  deliveryId: string;
  delivery?: DeliveryDetail | null;
};

export function DeliveryNoteViewActions({ deliveryId, delivery }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (mode: "download" | "print") => {
    if (busy) return;
    setBusy(true);
    try {
      const d = delivery ?? (await getDelivery(deliveryId));
      if (!d) {
        toast({
          title: "Not found",
          description: "This delivery could not be loaded.",
          variant: "destructive",
        });
        return;
      }
      const result = await renderDeliveryNotePdf(d, mode);
      if (mode === "download") {
        toast({
          title: "PDF downloaded",
          description: `DeliveryNote-${deliveryId.replace(/[^a-zA-Z0-9-_]+/g, "_")}.pdf`,
        });
        return;
      }
      if (result && result.mode === "download-fallback") {
        toast({
          title: "Print blocked",
          description:
            "Allow popups to print from the PDF viewer. The file was downloaded instead.",
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not generate PDF.";
      toast({ title: "PDF error", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={busy}
        onClick={() => run("download")}
      >
        <Download className="h-4 w-4" aria-hidden />
        {busy ? "Generating…" : "Download PDF"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={busy}
        onClick={() => run("print")}
      >
        <Printer className="h-4 w-4" aria-hidden />
        {busy ? "Generating…" : "Print"}
      </Button>
    </div>
  );
}
