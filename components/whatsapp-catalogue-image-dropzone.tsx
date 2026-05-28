"use client";

import { useRef, useState } from "react";
import { ImageIcon, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

type Props = {
  previewUrl: string | null;
  hasImage: boolean;
  onPick: (file: File) => void;
  className?: string;
};

export function WhatsAppCatalogueImageDropzone({
  previewUrl,
  hasImage,
  onPick,
  className,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onPick(file);
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={hasImage ? "Replace catalogue image" : "Upload catalogue image"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFilePicker();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFilePicker}
        className={cn(
          "flex h-full min-h-[18rem] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 bg-muted/15 hover:border-muted-foreground/45 hover:bg-muted/25",
          className,
        )}
      >
        {previewUrl ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3">
            <div className="flex min-h-0 w-full flex-1 items-center justify-center py-2">
              <img
                src={previewUrl}
                alt="Catalogue post"
                className="max-h-[min(100%,20rem)] w-auto max-w-full object-contain"
              />
            </div>
            <p className="shrink-0 text-center text-xs text-muted-foreground">
              Click or drop to replace · PNG, JPEG, WebP, GIF · max 4 MB
            </p>
          </div>
        ) : (
          <div className="flex max-w-xs flex-col items-center gap-3 text-center">
            <ImageIcon
              className="h-11 w-11 text-muted-foreground/55"
              aria-hidden
            />
            <div className="space-y-1">
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                <Upload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Drop image here or click to browse
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                PNG, JPEG, WebP, or GIF · max 4 MB
              </p>
            </div>
          </div>
        )}
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
