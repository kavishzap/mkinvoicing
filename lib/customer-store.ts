export interface Customer {
  id: string
  type: "company" | "individual"
  companyName: string
  contactName: string
  fullName: string
  email: string
  phone: string
  street: string
  city: string
  postal: string
  country: string
  createdAt: string
}

class CustomerStore {
  private customers: Customer[] = [
    {
      id: "1",
      type: "company",
      companyName: "Acme Corporation",
      contactName: "John Smith",
      fullName: "",
      email: "john@acme.com",
      phone: "+1 555 0100",
      street: "123 Business Ave",
      city: "New York",
      postal: "10001",
      country: "USA",
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      type: "individual",
      companyName: "",
      contactName: "",
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: "+1 555 0200",
      street: "456 Main St",
      city: "Los Angeles",
      postal: "90001",
      country: "USA",
      createdAt: new Date().toISOString(),
    },
  ]

  getAll(): Customer[] {
    return this.customers
  }

  getById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id)
  }

  add(customer: Omit<Customer, "id" | "createdAt">): Customer {
    const newCustomer: Customer = {
      ...customer,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    this.customers.push(newCustomer)
    return newCustomer
  }

  update(id: string, customer: Partial<Customer>): void {
    const index = this.customers.findIndex((c) => c.id === id)
    if (index !== -1) {
      this.customers[index] = { ...this.customers[index], ...customer }
    }
  }

  delete(id: string): void {
    this.customers = this.customers.filter((c) => c.id !== id)
  }

  search(query: string): Customer[] {
    const lowerQuery = query.toLowerCase()
    return this.customers.filter(
      (c) =>
        c.companyName.toLowerCase().includes(lowerQuery) ||
        c.fullName.toLowerCase().includes(lowerQuery) ||
        c.email.toLowerCase().includes(lowerQuery) ||
        c.contactName.toLowerCase().includes(lowerQuery),
    )
  }
}

export const customerStore = new CustomerStore()
