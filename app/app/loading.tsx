import { DirectoryListPageSkeleton } from "@/components/page-skeletons";

export default function AppLoading() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col px-4 py-4 text-sm sm:px-5 sm:py-5">
      <DirectoryListPageSkeleton className="min-h-[420px] flex-1" />
    </div>
  );
}
