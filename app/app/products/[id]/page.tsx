import { redirect } from "next/navigation";

/** `/products/[id]` → edit screen (same as row navigation target). */
export default async function ProductDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/products/${id}/edit`);
}
