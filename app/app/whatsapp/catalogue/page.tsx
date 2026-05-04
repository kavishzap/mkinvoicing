"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ImageIcon,
  Share2,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AppPageShell } from "@/components/app-page-shell";
import { getActiveCompanyId } from "@/lib/active-company";
import {
  deleteCataloguePost,
  getCataloguePost,
  listCataloguePosts,
  type CataloguePostRow,
} from "@/lib/whatsapp-catalogue-service";
import {
  listGroupMembers,
  listWhatsAppGroups,
  type WhatsAppGroupMemberRow,
  type WhatsAppGroupRow,
} from "@/lib/whatsapp-groups-service";
import {
  openWhatsAppChat,
  toWhatsAppDigits,
} from "@/lib/whatsapp-share";

const NONE = "__none__";

function defaultShareBody(description: string): string {
  return description.trim();
}

export default function WhatsAppCataloguePage() {
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);

  const [posts, setPosts] = useState<CataloguePostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [sharePost, setSharePost] = useState<CataloguePostRow | null>(null);
  const [shareGroups, setShareGroups] = useState<WhatsAppGroupRow[]>([]);
  const [shareGroupId, setShareGroupId] = useState("");
  const [shareMembers, setShareMembers] = useState<WhatsAppGroupMemberRow[]>([]);
  const [shareMessage, setShareMessage] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const loadPosts = useCallback(async () => {
    if (companyReady !== true) return;
    setLoading(true);
    try {
      const res = await listCataloguePosts({ page, pageSize, includeInactive: false });
      setPosts(res.rows);
      setTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Failed to load posts", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [companyReady, page, pageSize, toast]);

  useEffect(() => {
    (async () => setCompanyReady(!!(await getActiveCompanyId())))();
  }, []);

  useEffect(() => {
    if (companyReady !== true) {
      if (companyReady === false) setLoading(false);
      return;
    }
    loadPosts();
  }, [companyReady, loadPosts]);

  async function handleDeletePost(id: string) {
    try {
      await deleteCataloguePost(id);
      toast({ title: "Post deleted" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    } finally {
      setDeleteId(null);
      await loadPosts();
    }
  }

  async function openShare(row: CataloguePostRow) {
    setShareLoading(true);
    setShareOpen(true);
    setShareGroupId("");
    setShareMembers([]);
    try {
      const full = await getCataloguePost(row.id);
      setSharePost(full);
      setShareMessage(defaultShareBody(full.description));
      const g = await listWhatsAppGroups({ page: 1, pageSize: 200, includeInactive: false });
      setShareGroups(g.rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Could not prepare share", description: msg, variant: "destructive" });
      setShareOpen(false);
      setSharePost(null);
    } finally {
      setShareLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!shareOpen || !shareGroupId) {
        setShareMembers([]);
        return;
      }
      try {
        const members = await listGroupMembers(shareGroupId);
        if (!cancelled) setShareMembers(members);
      } catch {
        if (!cancelled) setShareMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareOpen, shareGroupId]);

  function membersWithPhones() {
    return shareMembers.filter((m) => toWhatsAppDigits(m.phone));
  }

  function membersMissingPhone() {
    return shareMembers.filter((m) => !toWhatsAppDigits(m.phone));
  }

  function openOneChat(m: WhatsAppGroupMemberRow) {
    const d = toWhatsAppDigits(m.phone);
    if (!d) {
      toast({
        title: "Invalid phone",
        description: `No valid number for ${m.displayName}.`,
        variant: "destructive",
      });
      return;
    }
    openWhatsAppChat(d, shareMessage);
  }

  function openAllChatsSequentially() {
    const list = membersWithPhones();
    if (list.length === 0) {
      toast({
        title: "No valid numbers",
        description: "Add phone numbers to customers in this group.",
        variant: "destructive",
      });
      return;
    }
    list.forEach((m, i) => {
      const d = toWhatsAppDigits(m.phone)!;
      window.setTimeout(() => openWhatsAppChat(d, shareMessage), i * 550);
    });
    toast({
      title: `Opening ${list.length} chat(s)`,
      description:
        "If only one tab opened, allow pop-ups for this site and try again, or use each row’s button.",
    });
  }

  const sharePreviewUrl =
    sharePost?.imageBase64 && sharePost.imageMimeType
      ? `data:${sharePost.imageMimeType};base64,${sharePost.imageBase64}`
      : null;

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppPageShell
      leading={
        <Link href="/app/whatsapp">
          <Button variant="ghost" size="icon" aria-label="Back to WhatsApp">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Create catalogue posts with an image and description; share links prefill text only—add the image in WhatsApp after the chat opens."
      actions={
        companyReady === true ? (
          <Button asChild className="gap-2 shrink-0">
            <Link href="/app/whatsapp/catalogue/new">
              <Plus className="h-4 w-4" />
              New post
            </Link>
          </Button>
        ) : (
          <Button type="button" className="gap-2 shrink-0" disabled>
            <Plus className="h-4 w-4" />
            New post
          </Button>
        )
      }
    >
      {companyReady === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company linked. Catalogue posts require a company context.
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-3 text-left w-24">Image</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : (
              posts.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">
                    {p.imageMimeType ? (
                      <span className="inline-flex rounded border bg-muted p-1">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 max-w-md">
                    <p className="line-clamp-3 text-foreground">{p.description || "—"}</p>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mr-1 gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      onClick={() => openShare(p)}
                      disabled={companyReady !== true}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <Link href={`/app/whatsapp/catalogue/${p.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteId(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
            {!loading && posts.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-muted-foreground">
                  No posts yet. Create your first catalogue entry.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {companyReady === true && !loading && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} / {pages} — {total} post(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((x) => Math.max(1, x - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((x) => Math.min(pages, x + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Share to WhatsApp
            </DialogTitle>
            <DialogDescription>
              Pick a group, edit the message, then open WhatsApp per contact. Bulk open may require
              allowing pop-ups.
            </DialogDescription>
          </DialogHeader>

          {shareLoading || !sharePost ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-4 py-2">
              {sharePreviewUrl && (
                <div className="flex justify-center">
                  <img
                    src={sharePreviewUrl}
                    alt=""
                    className="max-h-40 rounded-md border object-contain"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Group</Label>
                <Select
                  value={shareGroupId || NONE}
                  onValueChange={(v) => setShareGroupId(v === NONE ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Choose a group</SelectItem>
                    {shareGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Message (prefilled in WhatsApp)</Label>
                <Textarea rows={6} value={shareMessage} onChange={(e) => setShareMessage(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={openAllChatsSequentially}
                  disabled={!shareGroupId || membersWithPhones().length === 0}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open all chats
                </Button>
              </div>

              {shareGroupId && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Contacts in group</p>
                  {membersMissingPhone().length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {membersMissingPhone().length} member(s) have no usable phone number and are skipped.
                    </p>
                  )}
                  <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                    {shareMembers.map((m) => {
                      const ok = !!toWhatsAppDigits(m.phone);
                      return (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-medium">{m.displayName}</span>
                            <span className="block text-xs text-muted-foreground">{m.phone || "—"}</span>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 gap-1 text-emerald-700"
                            disabled={!ok}
                            onClick={() => openOneChat(m)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WA
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteId && handleDeletePost(deleteId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
