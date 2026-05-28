"use client";
import { SettingsTwoColumnSkeleton, FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, FileText, ImageIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { WhatsAppCatalogueImageDropzone } from "@/components/whatsapp-catalogue-image-dropzone";
import { useToast } from "@/hooks/use-toast";
import { stripDataUrlPrefix } from "@/lib/products-service";
import {
  getCataloguePost,
  updateCataloguePost,
} from "@/lib/whatsapp-catalogue-service";
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

type InitialSnapshot = {
  description: string;
  imageBase64: string | null;
  imageMime: string | null;
};

const formGridClass =
  "grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10";

const cardShellClass =
  "flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-lg border bg-card py-0 shadow-sm";

const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";

const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";

function CatalogueSectionCard({
  icon: Icon,
  title,
  children,
  contentClassName,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card className={cardShellClass}>
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent
        className={cn("flex min-h-0 flex-1 flex-col", contentClassName)}
      >
        {children}
      </CardContent>
    </Card>
  );
}

function BackButton() {
  return (
    <Button variant="ghost" size="icon" asChild aria-label="Back to catalogue">
      <Link href="/app/whatsapp?tab=catalogue">
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </Button>
  );
}

export default function EditWhatsAppCataloguePostPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [desc, setDesc] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [initial, setInitial] = useState<InitialSnapshot | null>(null);
  const [saving, setSaving] = useState(false);

  const previewUrl =
    imageBase64 && imageMime ? `data:${imageMime};base64,${imageBase64}` : null;
  const hasImage = Boolean(imageBase64 && imageMime);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    if (desc !== initial.description) return true;
    if (imageBase64 !== initial.imageBase64) return true;
    if (imageMime !== initial.imageMime) return true;
    return false;
  }, [desc, imageBase64, imageMime, initial]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await getCataloguePost(id);
        if (cancelled) return;
        const snapshot: InitialSnapshot = {
          description: p.description ?? "",
          imageBase64: p.imageBase64,
          imageMime: p.imageMimeType || null,
        };
        setInitial(snapshot);
        setDesc(snapshot.description);
        setImageBase64(snapshot.imageBase64);
        setImageMime(snapshot.imageMime);
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Could not load post",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
          router.replace("/app/whatsapp?tab=catalogue");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router, toast]);

  function onPickImage(file: File) {
    if (!ALLOWED_MIME.has(file.type)) {
      toast({
        title: "Unsupported image",
        description: "Use PNG, JPEG, WebP, or GIF.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: "File too large",
        description: "Max 4 MB.",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const b64 = stripDataUrlPrefix(reader.result as string);
        setImageBase64(b64);
        setImageMime(file.type);
      } catch {
        toast({ title: "Could not read image", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !isDirty) return;
    try {
      setSaving(true);
      await updateCataloguePost(id, {
        description: desc,
        imageBase64,
        imageMimeType: imageMime,
      });
      toast({ title: "Post updated" });
      router.push("/app/whatsapp?tab=catalogue");
    } catch (err: unknown) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppPageShell
        fillHeight
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={<BackButton />}
      >
        <div className={formGridClass}>
          <SettingsTwoColumnSkeleton />
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={<BackButton />}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button" asChild>
            <Link href="/app/whatsapp?tab=catalogue">Cancel</Link>
          </Button>
          <Button
            type="submit"
            form="wa-catalogue-edit"
            disabled={saving || !isDirty}
            className="font-semibold shadow-sm"
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form
        id="wa-catalogue-edit"
        onSubmit={handleSubmit}
        className={cn(formGridClass, "w-full")}
      >
        <CatalogueSectionCard
          icon={ImageIcon}
          title="Post"
          contentClassName="p-4 sm:p-5"
        >
          <WhatsAppCatalogueImageDropzone
            className="min-h-0 flex-1"
            previewUrl={previewUrl}
            hasImage={hasImage}
            onPick={onPickImage}
          />
        </CatalogueSectionCard>

        <CatalogueSectionCard
          icon={FileText}
          title="Details"
          contentClassName="field-controls gap-4 px-4 py-5"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <Label htmlFor="post-desc">Description</Label>
            <Textarea
              id="post-desc"
              rows={14}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What you want to say when sharing this post…"
              className="min-h-[18rem] flex-1 resize-y text-sm leading-relaxed"
            />
          </div>
        </CatalogueSectionCard>
      </form>
    </AppPageShell>
  );
}
