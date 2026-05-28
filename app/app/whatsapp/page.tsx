"use client";

import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ImageIcon, Plus, SlidersVertical, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPageShell } from "@/components/app-page-shell";
import { WhatsAppCatalogueTab } from "@/components/whatsapp-catalogue-tab";
import { WhatsAppGroupsTab } from "@/components/whatsapp-groups-tab";
import { getActiveCompanyId } from "@/lib/active-company";
import { cn } from "@/lib/utils";

type MainTab = "groups" | "catalogue";

function parseTab(raw: string | null): MainTab {
  return raw === "catalogue" ? "catalogue" : "groups";
}

export default function WhatsAppPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState<MainTab>(() =>
    parseTab(searchParams.get("tab")),
  );
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    setMainTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      setCompanyReady(!!(await getActiveCompanyId()));
    })();
  }, []);

  const showDirectory = companyReady === true;

  const filterPanelId =
    mainTab === "groups"
      ? "whatsapp-groups-filter-panel"
      : "whatsapp-catalogue-filter-panel";

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      actions={
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {mainTab === "groups" ? (
            <Button className="gap-2" disabled={companyReady !== true} asChild>
              <Link href="/app/whatsapp/groups/new">
                <Plus className="h-4 w-4" />
                New group
              </Link>
            </Button>
          ) : (
            <Button className="gap-2" disabled={companyReady !== true} asChild>
              <Link href="/app/whatsapp/catalogue/new">
                <Plus className="h-4 w-4" />
                New post
              </Link>
            </Button>
          )}
        </div>
      }
      topbarTrailingBeforeTheme={
        showDirectory ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 text-muted-foreground",
              filtersOpen && "bg-primary/15 text-primary",
            )}
            aria-label={
              filtersOpen ? "Hide WhatsApp filters" : "Show WhatsApp filters"
            }
            aria-expanded={filtersOpen}
            aria-controls={filterPanelId}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersVertical className="h-4 w-4" aria-hidden />
          </Button>
        ) : null
      }
    >
      {companyReady === null ? (
        <DirectoryListPageSkeleton className="min-h-[420px]" />
      ) : (
        <Tabs
          value={mainTab}
          onValueChange={(v) => {
            const tab = parseTab(v);
            setMainTab(tab);
            router.replace(`/app/whatsapp?tab=${tab}`, { scroll: false });
          }}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1 p-1 sm:inline-flex sm:w-auto sm:max-w-md">
            <TabsTrigger value="groups" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
              WhatsApp groups
            </TabsTrigger>
            <TabsTrigger value="catalogue" className="gap-1.5 text-xs sm:text-sm">
              <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              WhatsApp catalogue
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="groups"
            className="mt-0 flex min-h-0 flex-1 flex-col outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <WhatsAppGroupsTab
              companyReady={companyReady}
              filtersOpen={filtersOpen}
            />
          </TabsContent>

          <TabsContent
            value="catalogue"
            className="mt-0 flex min-h-0 flex-1 flex-col outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <WhatsAppCatalogueTab
              companyReady={companyReady}
              filtersOpen={filtersOpen}
            />
          </TabsContent>
        </Tabs>
      )}
    </AppPageShell>
  );
}
