/** Line shape used by new/edit sales order forms when merging duplicate products. */
export type MergeableSalesOrderLine = {
  id: string;
  productId: string | null;
  item: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
};

export type ProductPickForLine = {
  id: string;
  name: string;
  description: string;
  salePrice: number;
};

/**
 * If another line already has this product, add this line's quantity to that line
 * and remove the current line. Otherwise apply the product to the current line.
 *
 * When merging, quantity added to the kept line uses the picked line's quantity if
 * it is a finite value greater than zero; otherwise 1. When applying to a single line,
 * quantity follows the same rule so picking a product fills a sensible default qty.
 */
export function applyProductPickToLines<T extends MergeableSalesOrderLine>(
  lines: T[],
  lineId: string,
  product: ProductPickForLine
): T[] {
  const current = lines.find((l) => l.id === lineId);
  if (!current) return lines;

  const other = lines.find(
    (l) => l.id !== lineId && l.productId === product.id
  );

  if (other) {
    const q = Number(current.quantity);
    const addQty = Number.isFinite(q) && q > 0 ? q : 1;
    const withoutCurrent = lines.filter((l) => l.id !== lineId);
    if (withoutCurrent.length === 0) return lines;
    return withoutCurrent.map((l) =>
      l.id === other.id
        ? { ...l, quantity: Number(l.quantity) + addQty }
        : l
    );
  }

  return lines.map((l) => {
    if (l.id !== lineId) return l;
    const q = Number(l.quantity);
    const quantity = Number.isFinite(q) && q > 0 ? q : 1;
    return {
      ...l,
      productId: product.id,
      item: product.name,
      description: product.description || "",
      unitPrice: product.salePrice,
      quantity,
    };
  });
}
