"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  EmployeeRow,
  EmployeeStatus,
  PaymentType,
} from "@/lib/employees-service";

export type PayrollEmployeeFormData = {
  full_name: string;
  phone: string;
  email: string;
  position: string;
  basic_salary: string;
  payment_type: PaymentType;
  join_date: string;
  status: EmployeeStatus;
  transport_allowance: string;
  other_allowance: string;
};

export function emptyPayrollEmployeeForm(): PayrollEmployeeFormData {
  return {
    full_name: "",
    phone: "",
    email: "",
    position: "",
    basic_salary: "",
    payment_type: "monthly",
    join_date: new Date().toISOString().slice(0, 10),
    status: "active",
    transport_allowance: "0",
    other_allowance: "0",
  };
}

export function employeeRowToPayrollForm(emp: EmployeeRow): PayrollEmployeeFormData {
  return {
    full_name: emp.full_name,
    phone: emp.phone ?? "",
    email: emp.email ?? "",
    position: emp.position ?? "",
    basic_salary: String(emp.basic_salary || ""),
    payment_type: emp.payment_type,
    join_date: emp.join_date,
    status: emp.status,
    transport_allowance: String(emp.transport_allowance || ""),
    other_allowance: String(emp.other_allowance || ""),
  };
}

export function PayrollEmployeeFormFields({
  formData,
  setFormData,
  errors,
}: {
  formData: PayrollEmployeeFormData;
  setFormData: React.Dispatch<React.SetStateAction<PayrollEmployeeFormData>>;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <Label>Full Name *</Label>
        <Input
          value={formData.full_name}
          onChange={(e) => setFormData((f) => ({ ...f, full_name: e.target.value }))}
          placeholder="John Doe"
          className={errors.full_name ? "border-destructive" : ""}
        />
        {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Phone</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+230 5xx xx xx"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
            placeholder="john@example.com"
          />
        </div>
      </div>
      <div>
        <Label>Position</Label>
        <Input
          value={formData.position}
          onChange={(e) => setFormData((f) => ({ ...f, position: e.target.value }))}
          placeholder="e.g. Cashier, Manager"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Basic Salary (Rs) *</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.basic_salary}
            onChange={(e) => setFormData((f) => ({ ...f, basic_salary: e.target.value }))}
            placeholder="15000"
            className={errors.basic_salary ? "border-destructive" : ""}
          />
          {errors.basic_salary && (
            <p className="text-xs text-destructive">{errors.basic_salary}</p>
          )}
        </div>
        <div>
          <Label>Payment Type</Label>
          <select
            className="h-9 w-full rounded-md border bg-background px-3"
            value={formData.payment_type}
            onChange={(e) =>
              setFormData((f) => ({ ...f, payment_type: e.target.value as PaymentType }))
            }
          >
            <option value="monthly">Monthly</option>
            <option value="daily">Daily</option>
            <option value="hourly">Hourly</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Transport Allowance (Rs)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.transport_allowance}
            onChange={(e) => setFormData((f) => ({ ...f, transport_allowance: e.target.value }))}
          />
        </div>
        <div>
          <Label>Other Allowance (Rs)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.other_allowance}
            onChange={(e) => setFormData((f) => ({ ...f, other_allowance: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Join Date *</Label>
          <Input
            type="date"
            value={formData.join_date}
            onChange={(e) => setFormData((f) => ({ ...f, join_date: e.target.value }))}
            className={errors.join_date ? "border-destructive" : ""}
          />
          {errors.join_date && <p className="text-xs text-destructive">{errors.join_date}</p>}
        </div>
        <div>
          <Label>Status</Label>
          <select
            className="h-9 w-full rounded-md border bg-background px-3"
            value={formData.status}
            onChange={(e) =>
              setFormData((f) => ({ ...f, status: e.target.value as EmployeeStatus }))
            }
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
    </div>
  );
}
