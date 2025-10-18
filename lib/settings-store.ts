// Simple in-memory store for settings (UI only)
export interface ProfileSettings {
  accountType: "company" | "individual"
  // Company fields
  companyName?: string
  logoUrl?: string
  registrationId?: string
  // Individual fields
  fullName?: string
  // Common fields
  email: string
  phone: string
  website?: string
  street: string
  city: string
  postal: string
  country: string
  taxId?: string
}

export interface InvoicePreferences {
  currency: string
  dateFormat: string
  numberPrefix: string
  nextNumber: number
  numberPadding: number
  paymentTerms: number
  defaultNotes: string
  defaultTerms: string
  accentColor: string
}

let profileSettings: ProfileSettings = {
  accountType: "company",
  companyName: "My Company",
  email: "hello@mycompany.com",
  phone: "+1 234 567 8900",
  street: "123 Business St",
  city: "New York",
  postal: "10001",
  country: "United States",
}

let invoicePreferences: InvoicePreferences = {
  currency: "USD",
  dateFormat: "DD/MM/YYYY",
  numberPrefix: "INV",
  nextNumber: 1001,
  numberPadding: 4,
  paymentTerms: 14,
  defaultNotes: "Thank you for your business!",
  defaultTerms: "Payment is due within 14 days of invoice date.",
  accentColor: "#5B8DEF",
}

export const settingsStore = {
  getProfile: () => profileSettings,
  updateProfile: (updates: Partial<ProfileSettings>) => {
    profileSettings = { ...profileSettings, ...updates }
  },

  getPreferences: () => invoicePreferences,
  updatePreferences: (updates: Partial<InvoicePreferences>) => {
    invoicePreferences = { ...invoicePreferences, ...updates }
  },
}
