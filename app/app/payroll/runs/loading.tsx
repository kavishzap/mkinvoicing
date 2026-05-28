import { TableListPageSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-4 text-sm sm:px-5 sm:py-5">
      <TableListPageSkeleton className="min-h-[420px]" />
    </div>
  );
}
