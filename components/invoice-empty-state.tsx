"use client"

import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useRouter } from "next/navigation"

export function InvoiceEmptyState() {
  const router = useRouter()

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <FileText className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No invoices yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Create your first invoice to get started with managing your billing
        </p>
        <Button onClick={() => router.push("/app/invoices/new")} size="lg">
          Create your first invoice
        </Button>
      </CardContent>
    </Card>
  )
}
