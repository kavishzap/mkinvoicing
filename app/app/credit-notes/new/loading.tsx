import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";

export default function NewCreditNoteLoading() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col px-3 sm:px-4 md:px-5 lg:px-6">
      <FormTwoColumnPageSkeleton withLineItems />
    </div>
  );
}
