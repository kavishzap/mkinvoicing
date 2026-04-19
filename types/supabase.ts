export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          billing_contact_email: string | null
          billing_contact_name: string | null
          billing_contact_phone: string | null
          brn: string | null
          city: string | null
          company_code: string
          company_logo_url: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_trial: boolean | null
          max_users_override: number | null
          name: string
          owner_user_id: string
          phone: string | null
          plan_id: string
          subscription_end_date: string | null
          subscription_start_date: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          brn?: string | null
          city?: string | null
          company_code: string
          company_logo_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_trial?: boolean | null
          max_users_override?: number | null
          name: string
          owner_user_id: string
          phone?: string | null
          plan_id: string
          subscription_end_date?: string | null
          subscription_start_date?: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          brn?: string | null
          city?: string | null
          company_code?: string
          company_logo_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_trial?: boolean | null
          max_users_override?: number | null
          name?: string
          owner_user_id?: string
          phone?: string | null
          plan_id?: string
          subscription_end_date?: string | null
          subscription_start_date?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_roles: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean | null
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          id: string
          invited_at: string | null
          is_active: boolean
          is_owner: boolean
          joined_at: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          invited_at?: string | null
          is_active?: boolean
          is_owner?: boolean
          joined_at?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          invited_at?: string | null
          is_active?: boolean
          is_owner?: boolean
          joined_at?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "company_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_balances: {
        Row: {
          balance: number
          company_id: string | null
          created_at: string
          customer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          company_id?: string | null
          created_at?: string
          customer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          company_id?: string | null
          created_at?: string
          customer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_balances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_settlements: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          customer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_settlements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_settlements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_settlements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_list"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_id: string | null
          company_name: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          postal: string | null
          street: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          postal?: string | null
          street?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          postal?: string | null
          street?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_customers_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_advances: {
        Row: {
          amount: number
          amount_deducted: number
          company_id: string | null
          created_at: string
          deduction_per_period: number
          employee_id: string
          id: string
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          amount_deducted?: number
          company_id?: string | null
          created_at?: string
          deduction_per_period: number
          employee_id: string
          id?: string
          notes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          amount_deducted?: number
          company_id?: string | null
          created_at?: string
          deduction_per_period?: number
          employee_id?: string
          id?: string
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          basic_salary: number
          company_id: string | null
          created_at: string
          currency: string
          email: string | null
          full_name: string
          id: string
          join_date: string
          other_allowance: number
          payment_type: string
          phone: string | null
          position: string | null
          status: string
          transport_allowance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          basic_salary?: number
          company_id?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          full_name: string
          id?: string
          join_date?: string
          other_allowance?: number
          payment_type?: string
          phone?: string | null
          position?: string | null
          status?: string
          transport_allowance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          basic_salary?: number
          company_id?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          full_name?: string
          id?: string
          join_date?: string
          other_allowance?: number
          payment_type?: string
          phone?: string | null
          position?: string | null
          status?: string
          transport_allowance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_employees_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          company_id: string | null
          description: string | null
          expense_id: string
          id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          quantity: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          expense_id: string
          id?: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          expense_id?: string
          id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          company_id: string | null
          created_at: string
          currency: string
          description: string
          expense_date: string
          id: string
          invoice_id: string | null
          line_items: Json | null
          notes: string | null
          payment_method: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          description: string
          expense_date?: string
          id?: string
          invoice_id?: string | null
          line_items?: Json | null
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          invoice_id?: string | null
          line_items?: Json | null
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          company_id: string
          created_at: string
          event_type: string
          from_location_id: string | null
          id: string
          note: string | null
          product_id: string
          quantity: number
          to_location_id: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          event_type: string
          from_location_id?: string | null
          id?: string
          note?: string | null
          product_id: string
          quantity: number
          to_location_id?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          event_type?: string
          from_location_id?: string | null
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          to_location_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          invoice_id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          quantity: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          invoice_id: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          invoice_id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_list"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          bill_to_snapshot: Json
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          created_from_quotation_id: string | null
          created_from_sales_order_id: string | null
          credit_applied: number
          currency: string
          customer_id: string | null
          discount_amount: number
          discount_type: string | null
          due_date: string
          from_snapshot: Json
          id: string
          issue_date: string
          notes: string | null
          number: string
          payment_method: string | null
          shipping_amount: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          bill_to_snapshot: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          created_from_quotation_id?: string | null
          created_from_sales_order_id?: string | null
          credit_applied?: number
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          due_date: string
          from_snapshot: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          payment_method?: string | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          created_from_quotation_id?: string | null
          created_from_sales_order_id?: string | null
          credit_applied?: number
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          due_date?: string
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          payment_method?: string | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_from_quotation_id_fkey"
            columns: ["created_from_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_from_sales_order_id_fkey"
            columns: ["created_from_sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          code: string | null
          company_id: string
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          postal: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          code?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          postal?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          code?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          postal?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          company_id: string | null
          created_at: string
          currency: string
          id: string
          month: number
          status: string
          total_deductions: number
          total_gross: number
          total_net: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          month: number
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          month?: number
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_payroll_runs_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_advance_deductions: {
        Row: {
          advance_id: string
          amount: number
          company_id: string | null
          created_at: string
          id: string
          payslip_id: string
        }
        Insert: {
          advance_id: string
          amount: number
          company_id?: string | null
          created_at?: string
          id?: string
          payslip_id: string
        }
        Update: {
          advance_id?: string
          amount?: number
          company_id?: string | null
          created_at?: string
          id?: string
          payslip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_advance_deductions_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "employee_advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_advance_deductions_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          absence_deduction: number
          advance_deduction: number
          basic_salary: number
          company_id: string | null
          created_at: string
          employee_id: string
          expense_id: string | null
          gross_salary: number
          id: string
          net_salary: number
          notes: string | null
          other_allowance: number
          other_deduction: number
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          payroll_run_id: string
          total_deductions: number
          transport_allowance: number
          updated_at: string
        }
        Insert: {
          absence_deduction?: number
          advance_deduction?: number
          basic_salary: number
          company_id?: string | null
          created_at?: string
          employee_id: string
          expense_id?: string | null
          gross_salary: number
          id?: string
          net_salary: number
          notes?: string | null
          other_allowance?: number
          other_deduction?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          payroll_run_id: string
          total_deductions?: number
          transport_allowance?: number
          updated_at?: string
        }
        Update: {
          absence_deduction?: number
          advance_deduction?: number
          basic_salary?: number
          company_id?: string | null
          created_at?: string
          employee_id?: string
          expense_id?: string | null
          gross_salary?: number
          id?: string
          net_salary?: number
          notes?: string | null
          other_allowance?: number
          other_deduction?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          payroll_run_id?: string
          total_deductions?: number
          transport_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payslips_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          feature_id: string
          id: string
          is_enabled: boolean
          plan_id: string
        }
        Insert: {
          feature_id: string
          id?: string
          is_enabled?: boolean
          plan_id: string
        }
        Update: {
          feature_id?: string
          id?: string
          is_enabled?: boolean
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_cycle: string
          created_at: string
          currency: string | null
          description: string | null
          id: string
          is_active: boolean
          max_users: number
          name: string
          price: number
        }
        Insert: {
          billing_cycle: string
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_users?: number
          name: string
          price?: number
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_users?: number
          name?: string
          price?: number
        }
        Relationships: []
      }
      preferences: {
        Row: {
          company_id: string | null
          created_at: string
          currency: string
          default_notes: string | null
          default_terms: string | null
          id: string
          next_number: number
          number_padding: number
          number_prefix: string
          payment_terms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency?: string
          default_notes?: string | null
          default_terms?: string | null
          id?: string
          next_number?: number
          number_padding?: number
          number_prefix?: string
          payment_terms?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency?: string
          default_notes?: string | null
          default_terms?: string | null
          id?: string
          next_number?: number
          number_padding?: number
          number_prefix?: string
          payment_terms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_location_stocks: {
        Row: {
          company_id: string
          created_at: string
          id: string
          location_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          location_id: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          location_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_location_stocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_stocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          company_id: string
          cost_price: number
          created_at: string
          currency: string
          description: string | null
          id: string
          image_base64: string | null
          image_mime_type: string | null
          is_active: boolean
          name: string
          sale_price: number
          sku: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          cost_price?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_base64?: string | null
          image_mime_type?: string | null
          is_active?: boolean
          name: string
          sale_price?: number
          sku?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          cost_price?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_base64?: string | null
          image_mime_type?: string | null
          is_active?: boolean
          name?: string
          sale_price?: number
          sku?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          address_line_1: string | null
          address_line_2: string | null
          bank_acc_num: string | null
          bank_name: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          logo_url: string | null
          phone: string | null
          postal: string | null
          registration_id: string | null
          street: string | null
          tax_id: string | null
          updated_at: string | null
          vat_number: string | null
          vat_registered: boolean
        }
        Insert: {
          account_type?: string
          address_line_1?: string | null
          address_line_2?: string | null
          bank_acc_num?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          logo_url?: string | null
          phone?: string | null
          postal?: string | null
          registration_id?: string | null
          street?: string | null
          tax_id?: string | null
          updated_at?: string | null
          vat_number?: string | null
          vat_registered?: boolean
        }
        Update: {
          account_type?: string
          address_line_1?: string | null
          address_line_2?: string | null
          bank_acc_num?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          postal?: string | null
          registration_id?: string | null
          street?: string | null
          tax_id?: string | null
          updated_at?: string | null
          vat_number?: string | null
          vat_registered?: boolean
        }
        Relationships: []
      }
      purchase_invoice_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          purchase_invoice_id: string
          quantity: number
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          purchase_invoice_id: string
          quantity: number
          sort_order?: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          purchase_invoice_id?: string
          quantity?: number
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          bill_to_snapshot: Json
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          created_from_purchase_order_id: string | null
          currency: string
          discount_amount: number
          discount_type: string | null
          due_date: string
          from_snapshot: Json
          id: string
          issue_date: string
          notes: string | null
          number: string
          payment_method: string | null
          shipping_amount: number
          status: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal: number
          supplier_id: string | null
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          created_from_purchase_order_id?: string | null
          currency?: string
          discount_amount?: number
          discount_type?: string | null
          due_date: string
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          payment_method?: string | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          created_from_purchase_order_id?: string | null
          currency?: string
          discount_amount?: number
          discount_type?: string | null
          due_date?: string
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          payment_method?: string | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_invoices_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_created_from_purchase_order_id_fkey"
            columns: ["created_from_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          purchase_order_id: string
          quantity: number
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          purchase_order_id: string
          quantity: number
          sort_order?: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          purchase_order_id?: string
          quantity?: number
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          bill_to_snapshot: Json
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          discount_type: string | null
          from_snapshot: Json
          id: string
          issue_date: string
          notes: string | null
          number: string
          shipping_amount: number
          status: Database["public"]["Enums"]["purchase_order_status"]
          subtotal: number
          supplier_id: string | null
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          bill_to_snapshot: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          discount_type?: string | null
          from_snapshot: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          shipping_amount?: number
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          discount_type?: string | null
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          shipping_amount?: number
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_orders_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          quantity: number
          quotation_id: string
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity: number
          quotation_id: string
          sort_order?: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity?: number
          quotation_id?: string
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          bill_to_snapshot: Json
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          currency: string
          customer_id: string | null
          discount_amount: number
          discount_type: string | null
          from_snapshot: Json
          id: string
          issue_date: string
          notes: string | null
          number: string
          shipping_amount: number
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          bill_to_snapshot: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          from_snapshot: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          shipping_amount?: number
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          shipping_amount?: number
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_quotations_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_features: {
        Row: {
          feature_id: string
          id: string
          role_id: string
        }
        Insert: {
          feature_id: string
          id?: string
          role_id: string
        }
        Update: {
          feature_id?: string
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_features_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "company_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          quantity: number
          sales_order_id: string
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity: number
          sales_order_id: string
          sort_order?: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity?: number
          sales_order_id?: string
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          bill_to_snapshot: Json
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          created_from_quotation_id: string | null
          currency: string
          customer_id: string | null
          discount_amount: number
          discount_type: string | null
          from_snapshot: Json
          id: string
          issue_date: string
          notes: string | null
          number: string
          shipping_amount: number
          status: Database["public"]["Enums"]["sales_order_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          bill_to_snapshot: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          created_from_quotation_id?: string | null
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          from_snapshot: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          shipping_amount?: number
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          created_from_quotation_id?: string | null
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          shipping_amount?: number
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_orders_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_created_from_quotation_id_fkey"
            columns: ["created_from_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_id: string | null
          company_name: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          postal: string | null
          registration_id: string | null
          street: string | null
          supplier_code: string | null
          type: string
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          postal?: string | null
          registration_id?: string | null
          street?: string | null
          supplier_code?: string | null
          type?: string
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          postal?: string | null
          registration_id?: string | null
          street?: string | null
          supplier_code?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_suppliers_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          system_role: Database["public"]["Enums"]["system_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          system_role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          system_role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          company_id: string | null
          created_at: string | null
          currency: string
          default_notes: string | null
          default_terms: string | null
          next_number: number
          number_padding: number
          number_prefix: string
          payment_terms: number
          purchase_invoice_next_number: number
          purchase_invoice_number_padding: number
          purchase_invoice_prefix: string
          purchase_order_next_number: number
          purchase_order_number_padding: number
          purchase_order_prefix: string
          quotation_next_number: number
          quotation_number_padding: number
          quotation_prefix: string
          sales_order_next_number: number
          sales_order_number_padding: number
          sales_order_prefix: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          currency?: string
          default_notes?: string | null
          default_terms?: string | null
          next_number?: number
          number_padding?: number
          number_prefix?: string
          payment_terms?: number
          purchase_invoice_next_number?: number
          purchase_invoice_number_padding?: number
          purchase_invoice_prefix?: string
          purchase_order_next_number?: number
          purchase_order_number_padding?: number
          purchase_order_prefix?: string
          quotation_next_number?: number
          quotation_number_padding?: number
          quotation_prefix?: string
          sales_order_next_number?: number
          sales_order_number_padding?: number
          sales_order_prefix?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          currency?: string
          default_notes?: string | null
          default_terms?: string | null
          next_number?: number
          number_padding?: number
          number_prefix?: string
          payment_terms?: number
          purchase_invoice_next_number?: number
          purchase_invoice_number_padding?: number
          purchase_invoice_prefix?: string
          purchase_order_next_number?: number
          purchase_order_number_padding?: number
          purchase_order_prefix?: string
          quotation_next_number?: number
          quotation_number_padding?: number
          quotation_prefix?: string
          sales_order_next_number?: number
          sales_order_number_padding?: number
          sales_order_prefix?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_catalogue_posts: {
        Row: {
          company_id: string
          created_at: string
          description: string
          id: string
          image_base64: string | null
          image_mime_type: string | null
          is_active: boolean
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string
          id?: string
          image_base64?: string | null
          image_mime_type?: string | null
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          image_base64?: string | null
          image_mime_type?: string | null
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_catalogue_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_group_customers: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
          whatsapp_group_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          whatsapp_group_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          whatsapp_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_customers_group_id_fkey"
            columns: ["whatsapp_group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_applications: {
        Row: {
          areas_served: string | null
          bio: string
          created_at: string
          district: string
          email: string | null
          first_name: string
          id: string
          job_types: string[]
          last_name: string
          other_job_type: string | null
          phone: string
          profile_status: Database["public"]["Enums"]["worker_profile_status"]
          services_offered: string[]
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          terms_accepted_at: string
          updated_at: string
          user_id: string | null
          worker_kind: Database["public"]["Enums"]["worker_kind"]
          years_experience: number
        }
        Insert: {
          areas_served?: string | null
          bio: string
          created_at?: string
          district: string
          email?: string | null
          first_name: string
          id?: string
          job_types: string[]
          last_name: string
          other_job_type?: string | null
          phone: string
          profile_status?: Database["public"]["Enums"]["worker_profile_status"]
          services_offered?: string[]
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          terms_accepted_at?: string
          updated_at?: string
          user_id?: string | null
          worker_kind: Database["public"]["Enums"]["worker_kind"]
          years_experience: number
        }
        Update: {
          areas_served?: string | null
          bio?: string
          created_at?: string
          district?: string
          email?: string | null
          first_name?: string
          id?: string
          job_types?: string[]
          last_name?: string
          other_job_type?: string | null
          phone?: string
          profile_status?: Database["public"]["Enums"]["worker_profile_status"]
          services_offered?: string[]
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          terms_accepted_at?: string
          updated_at?: string
          user_id?: string | null
          worker_kind?: Database["public"]["Enums"]["worker_kind"]
          years_experience?: number
        }
        Relationships: []
      }
      worker_monthly_payments: {
        Row: {
          created_at: string
          id: string
          month: number
          note: string | null
          paid_at: string | null
          status: string
          updated_at: string
          worker_application_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          note?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          worker_application_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          note?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          worker_application_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "worker_monthly_payments_worker_application_id_fkey"
            columns: ["worker_application_id"]
            isOneToOne: false
            referencedRelation: "worker_applications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory_stock_by_location: {
        Row: {
          balance_updated_at: string | null
          company_id: string | null
          location_code: string | null
          location_id: string | null
          location_name: string | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_location_stocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_stocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices_list: {
        Row: {
          bill_to_email: string | null
          bill_to_name: string | null
          bill_to_phone: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string | null
          issue_date: string | null
          number: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          status_text: string | null
          subtotal: number | null
          tax_total: number | null
          total: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bill_to_email?: never
          bill_to_name?: never
          bill_to_phone?: never
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string | null
          issue_date?: string | null
          number?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          status_text?: never
          subtotal?: number | null
          tax_total?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bill_to_email?: never
          bill_to_name?: never
          bill_to_phone?: never
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string | null
          issue_date?: string | null
          number?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          status_text?: never
          subtotal?: number | null
          tax_total?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_company: {
        Args: {
          p_billing_contact_email?: string
          p_billing_contact_name?: string
          p_email?: string
          p_name: string
          p_owner_user_id: string
          p_phone?: string
          p_plan_id: string
        }
        Returns: string
      }
      create_invoice:
        | {
            Args: {
              p_customer_id: string
              p_discount_amount: number
              p_discount_type: string
              p_due_date: string
              p_issue_date: string
              p_items: Database["public"]["CompositeTypes"]["invoice_item_input"][]
              p_notes: string
              p_shipping_amount: number
              p_terms: string
            }
            Returns: string
          }
        | { Args: { p_invoice: Json; p_items: Json }; Returns: string }
      create_purchase_invoice: {
        Args: { p_invoice: Json; p_items: Json }
        Returns: string
      }
      create_purchase_order: {
        Args: { p_items: Json; p_purchase_order: Json }
        Returns: string
      }
      create_quotation: {
        Args: { p_items: Json; p_quotation: Json }
        Returns: string
      }
      create_sales_order: {
        Args: { p_items: Json; p_sales_order: Json }
        Returns: string
      }
      get_plans: { Args: never; Returns: Json }
      refresh_purchase_invoice_overdue_statuses: {
        Args: never
        Returns: number
      }
    }
    Enums: {
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "unpaid"
        | "paid"
        | "void"
        | "cancelled"
      purchase_invoice_status:
        | "unpaid"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      purchase_order_status: "active" | "expired"
      quotation_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
        | "active"
      sales_order_status: "active" | "expired"
      subscription_plan: "monthly_100" | "yearly_1000"
      system_role: "admin" | "owner" | "member"
      worker_kind: "individual" | "contractor"
      worker_profile_status: "pending" | "active" | "inactive" | "rejected"
    }
    CompositeTypes: {
      invoice_item_input: {
        item: string | null
        description: string | null
        quantity: number | null
        unit_price: number | null
        tax_percent: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "unpaid",
        "paid",
        "void",
        "cancelled",
      ],
      purchase_invoice_status: [
        "unpaid",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      purchase_order_status: ["active", "expired"],
      quotation_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
        "active",
      ],
      sales_order_status: ["active", "expired"],
      subscription_plan: ["monthly_100", "yearly_1000"],
      system_role: ["admin", "owner", "member"],
      worker_kind: ["individual", "contractor"],
      worker_profile_status: ["pending", "active", "inactive", "rejected"],
    },
  },
} as const
