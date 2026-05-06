import { redirect } from "next/navigation";

/** Legacy URL: `/locations/[id]/edit` → detail page with tabs. */
export default async function EditLocationRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/locations/${id}?edit=1`);
}
