import { DirectoryListPageSkeleton } from "@/components/page-skeletons";

export default function CreditNotesLoading() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background">
      <DirectoryListPageSkeleton className="min-h-[420px] flex-1" />
    </div>
  );
}
