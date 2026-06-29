"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ActionProgressDialogProps = {
  open: boolean;
  message: string;
};

export function ActionProgressDialog({ open, message }: ActionProgressDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} modal>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby="action-progress-message"
        >
          <DialogTitle className="sr-only">Processing request</DialogTitle>
          <div className="flex flex-col items-center gap-4 py-2">
            <Loader2
              className="h-10 w-10 animate-spin text-primary"
              aria-hidden
            />
            <p
              id="action-progress-message"
              className="text-center text-sm font-medium leading-snug text-foreground"
            >
              {message || "Please wait…"}
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
