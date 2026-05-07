import { redirect } from "next/navigation";

/** Legacy URL; stock UI lives at `/app/inventory`. */
export default function InventoryStockRedirectPage() {
  redirect("/app/inventory");
}
