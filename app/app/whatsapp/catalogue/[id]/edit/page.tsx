"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { stripDataUrlPrefix } from "@/lib/products-service";
import {
  getCataloguePost,
  updateCataloguePost,
} from "@/lib/whatsapp-catalogue-service";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export default function EditWhatsAppCataloguePostPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [desc, setDesc] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previewUrl =
    imageBase64 && imageMime ? `data:${imageMime};base64,${imageBase64}` : null;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await getCataloguePost(id);
        if (cancelled) return;
        setDesc(p.description);
        setImageBase64(p.imageBase64);
        setImageMime(p.imageMimeType || null);
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Could not load post",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
          router.replace("/app/whatsapp/catalogue");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router, toast]);

  function onPickImage(file: File | null) {
    if (!file) return;
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
    if (!id) return;
    try {
      setSaving(true);
      await updateCataloguePost(id, {
        description: desc,
        imageBase64,
        imageMimeType: imageMime,
      });
      toast({ title: "Post updated" });
      router.push("/app/whatsapp/catalogue");
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
      <AppPageShell subtitle="Loading post…">
        <div className="h-48 max-w-lg animate-pulse rounded-lg border bg-muted/40" />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      subtitle="Update the description or image for this catalogue entry."
      leading={
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link href="/app/whatsapp/catalogue">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button" asChild>
            <Link href="/app/whatsapp/catalogue">Cancel</Link>
          </Button>
          <Button type="submit" form="wa-catalogue-edit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Edit catalogue post</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="wa-catalogue-edit" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="post-desc">Description</Label>
              <Textarea
                id="post-desc"
                rows={5}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What you want to say when sharing…"
              />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                  />
                  {(imageBase64 || imageMime) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        setImageBase64(null);
                        setImageMime(null);
                      }}
                    >
                      Remove image
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
