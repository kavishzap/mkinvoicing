// Simple in-memory store for UI-only invoice management
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "unpaid"

export interface Invoice {
  id: string
  number: string
  clientName: string
  clientType: "company" | "individual"
  issueDate: string
  dueDate: string
  status: InvoiceStatus
  total: number
  currency: string
}

let invoices: Invoice[] = []

export const invoiceStore = {
  getAll: () => invoices,

  add: (invoice: Invoice) => {
    invoices = [invoice, ...invoices]
  },

  getById: (id: string) => invoices.find((inv) => inv.id === id),

  update: (id: string, updates: Partial<Invoice>) => {
    invoices = invoices.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv))
  },

  delete: (id: string) => {
    invoices = invoices.filter((inv) => inv.id !== id)
  },
}
