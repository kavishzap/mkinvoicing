 "use client";
 export const dynamic = "force-dynamic";

 import { useState } from "react";
 import { useRouter } from "next/navigation";
 import { ArrowLeft, Plus, Trash2 } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { useToast } from "@/hooks/use-toast";
 import { addExpense, type ExpenseLineItem, type ExpensePayload } from "@/lib/expenses-service";
 import Link from "next/link";
 import { AppPageShell } from "@/components/app-page-shell";

 type LineItemRow = {
   id: string;
   item: string;
   description: string;
   quantity: number;
   unitPrice: number;
   tax: number;
 };

 const CURRENCIES = ["MUR", "USD", "EUR", "GBP"] as const;

 function emptyLineItems(): LineItemRow[] {
   return [
     {
       id: "1",
       item: "",
       description: "",
       quantity: 1,
       unitPrice: 0,
       tax: 0,
     },
   ];
 }

 function toPayload(
   lineItems: LineItemRow[],
   currency: string,
   expense_date: string,
   notes: string,
   description: string
 ): ExpensePayload {
   const items: ExpenseLineItem[] = lineItems
     .filter(
       (li) =>
         li.item.trim() ||
         (li.quantity && li.quantity > 0 && (li.unitPrice || li.tax))
     )
     .map((li) => {
       const quantity = Number(li.quantity) || 0;
       const unitPrice = Number(li.unitPrice) || 0;
       const tax = Number(li.tax) || 0;
       const lineTotal = quantity * unitPrice * (1 + tax / 100);
       return {
         item: li.item.trim(),
         description: li.description.trim() || undefined,
         quantity,
         unit_price: unitPrice,
         tax_percent: tax,
         line_total: lineTotal,
       };
     });
   const amount = items.reduce((s, li) => s + li.line_total, 0);
   const resolvedDescription =
     description.trim() || items[0]?.item || "Expense";
   return {
     description: resolvedDescription,
     amount,
     currency,
     expense_date,
     line_items:
       items.length ||
       description.trim()
         ? items.length
           ? items
           : [
               {
                 item: resolvedDescription,
                 description: undefined,
                 quantity: 1,
                 unit_price: amount,
                 tax_percent: 0,
                 line_total: amount,
               },
             ]
         : [],
     notes: notes.trim() || null,
   };
 }

 export default function NewExpensePage() {
   const router = useRouter();
   const { toast } = useToast();

   const [lineItems, setLineItems] = useState<LineItemRow[]>(emptyLineItems());
   const [currency, setCurrency] = useState("MUR");
   const [expenseDate, setExpenseDate] = useState(
     new Date().toISOString().slice(0, 10)
   );
   const [description, setDescription] = useState("");
   const [notes, setNotes] = useState("");
   const [errors, setErrors] = useState<{ lineItems?: string }>({});
   const [saving, setSaving] = useState(false);

   function addLineItem() {
     setLineItems((prev) => [
       ...prev,
       {
         id: String(Date.now()),
         item: "",
         description: "",
         quantity: 1,
         unitPrice: 0,
         tax: 0,
       },
     ]);
   }

   function removeLineItem(id: string) {
     setLineItems((prev) =>
       prev.length > 1 ? prev.filter((li) => li.id !== id) : prev
     );
   }

   function updateLineItem(
     id: string,
     field: keyof LineItemRow,
     value: string | number
   ) {
     setLineItems((prev) =>
       prev.map((li) =>
         li.id === id ? { ...li, [field]: value } : li
       )
     );
   }

   function validate(): boolean {
     const valid = lineItems.some(
       (li) =>
         li.item.trim() ||
         (li.quantity && li.quantity > 0 && li.unitPrice && li.unitPrice > 0)
     );
     if (!valid) {
       setErrors({ lineItems: "Add at least one line item with item and price" });
       return false;
     }
     setErrors({});
     return true;
   }

   async function handleSave() {
     if (!validate()) return;

     try {
       setSaving(true);
       const payload = toPayload(
         lineItems,
         currency,
         expenseDate,
         notes,
         description
       );
       await addExpense(payload);
       toast({
         title: "Expense added",
         description: "New expense has been added successfully.",
       });
       router.push("/app/expenses");
     } catch (e: unknown) {
       const err = e as { message?: string };
       toast({
         title: "Save failed",
         description: err?.message ?? "Please try again.",
         variant: "destructive",
       });
     } finally {
       setSaving(false);
     }
   }

   const totalAmount = lineItems.reduce((s, li) => {
     const quantity = Number(li.quantity) || 0;
     const unitPrice = Number(li.unitPrice) || 0;
     const tax = Number(li.tax) || 0;
     return s + quantity * unitPrice * (1 + tax / 100);
   }, 0);

  return (
     <AppPageShell
       className="max-w-7xl"
       subtitle="Enter date, description, and line items—totals include tax per line."
       actions={
         <div className="flex flex-wrap items-center gap-2">
           <Link href="/app/expenses">
             <Button variant="ghost" size="icon" aria-label="Back to expenses">
               <ArrowLeft className="h-4 w-4" />
             </Button>
           </Link>
           <Button
             variant="outline"
             type="button"
             onClick={() => router.push("/app/expenses")}
             disabled={saving}
           >
             Cancel
           </Button>
           <Button type="button" onClick={handleSave} disabled={saving}>
             {saving ? "Saving..." : "Save Expense"}
           </Button>
         </div>
       }
     >
       <Card>
         <CardHeader>
           <CardTitle>Expense Details</CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
           <div>
             <Label htmlFor="exp-description">Description</Label>
             <Input
               id="exp-description"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               placeholder="e.g. Office supplies, Travel"
             />
           </div>

           {errors.lineItems && (
             <p className="text-xs text-destructive">{errors.lineItems}</p>
           )}

           <div className="rounded-lg border overflow-x-auto">
             <table className="w-full text-sm">
               <thead className="bg-muted/50">
                 <tr>
                   <th className="text-left p-2 w-[160px]">Item *</th>
                   <th className="text-left p-2 w-[200px]">Description</th>
                   <th className="text-right p-2 w-[80px]">Qty *</th>
                   <th className="text-right p-2 w-[110px]">Unit Price *</th>
                   <th className="text-right p-2 w-[90px]">Tax %</th>
                   <th className="text-right p-2 w-[110px]">Total</th>
                   <th className="w-10"></th>
                 </tr>
               </thead>
               <tbody>
                 {lineItems.map((li) => {
                   const lineTotal =
                     (Number(li.quantity) || 0) *
                     (Number(li.unitPrice) || 0) *
                     (1 + (Number(li.tax) || 0) / 100);
                   return (
                     <tr key={li.id} className="border-t">
                       <td className="p-2">
                         <Input
                           value={li.item}
                           onChange={(e) =>
                             updateLineItem(li.id, "item", e.target.value)
                           }
                           placeholder="e.g. Office supplies"
                           className="h-9"
                         />
                       </td>
                       <td className="p-2">
                         <Input
                           value={li.description}
                           onChange={(e) =>
                             updateLineItem(
                               li.id,
                               "description",
                               e.target.value
                             )
                           }
                           placeholder="Optional description"
                           className="h-9"
                         />
                       </td>
                       <td className="p-2">
                         <Input
                           type="number"
                           min="1"
                           value={li.quantity}
                           onChange={(e) =>
                             updateLineItem(
                               li.id,
                               "quantity",
                               Number(e.target.value) || 0
                             )
                           }
                           className="h-9 text-right"
                         />
                       </td>
                       <td className="p-2">
                         <Input
                           type="number"
                           min="0"
                           step="0.01"
                           value={li.unitPrice}
                           onChange={(e) =>
                             updateLineItem(
                               li.id,
                               "unitPrice",
                               parseFloat(e.target.value) || 0
                             )
                           }
                           placeholder="0.00"
                           className="h-9 text-right"
                         />
                       </td>
                       <td className="p-2">
                         <Input
                           type="number"
                           min="0"
                           step="0.01"
                           value={li.tax}
                           onChange={(e) =>
                             updateLineItem(
                               li.id,
                               "tax",
                               parseFloat(e.target.value) || 0
                             )
                           }
                           placeholder="0"
                           className="h-9 text-right"
                         />
                       </td>
                       <td className="p-2 text-right">
                         {currency} {lineTotal.toFixed(2)}
                       </td>
                       <td className="p-2">
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => removeLineItem(li.id)}
                           disabled={lineItems.length === 1}
                           className="h-9 w-9"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>

           <Button
             variant="outline"
             size="sm"
             onClick={addLineItem}
             className="gap-2"
           >
             <Plus className="h-4 w-4" />
             Add Row
           </Button>

           <div className="pt-3 border-t flex items-center justify-between text-sm">
             <span className="text-muted-foreground">Total Amount</span>
             <span className="inline-flex items-center rounded-md bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
               {currency} {totalAmount.toFixed(2)}
             </span>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div>
               <Label htmlFor="exp-date">Date</Label>
               <Input
                 id="exp-date"
                 type="date"
                 value={expenseDate}
                 onChange={(e) => setExpenseDate(e.target.value)}
               />
             </div>
             <div>
               <Label htmlFor="exp-currency">Currency</Label>
               <Select value={currency} onValueChange={setCurrency}>
                 <SelectTrigger id="exp-currency">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {CURRENCIES.map((c) => (
                     <SelectItem key={c} value={c}>
                       {c}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           </div>

           <div>
             <Label htmlFor="exp-notes">Notes</Label>
             <Input
               id="exp-notes"
               value={notes}
               onChange={(e) => setNotes(e.target.value)}
               placeholder="Optional notes"
             />
           </div>
         </CardContent>
       </Card>
     </AppPageShell>
   );
 }

