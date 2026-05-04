"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { addEmployee, type EmployeePayload } from "@/lib/employees-service";
import {
  emptyPayrollEmployeeForm,
  PayrollEmployeeFormFields,
  type PayrollEmployeeFormData,
} from "@/components/payroll-employee-form-fields";

export default function NewPayrollEmployeePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState<PayrollEmployeeFormData>(() =>
    emptyPayrollEmployeeForm(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!formData.full_name?.trim()) next.full_name = "Required";
    if (!formData.basic_salary || Number(formData.basic_salary) < 0)
      next.basic_salary = "Required";
    if (!formData.join_date) next.join_date = "Required";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setSaving(true);
      const payload: EmployeePayload = {
        full_name: formData.full_name.trim(),
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        position: formData.position || undefined,
        basic_salary: Number(formData.basic_salary),
        payment_type: formData.payment_type,
        join_date: formData.join_date,
        status: formData.status,
        transport_allowance: Number(formData.transport_allowance) || 0,
        other_allowance: Number(formData.other_allowance) || 0,
      };
      await addEmployee(payload);
      toast({ title: "Employee added" });
      router.push("/app/payroll/employees");
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPageShell
      leading={
        <Link href="/app/payroll/employees">
          <Button variant="ghost" size="icon" aria-label="Back to employees">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Add a new employee to your payroll."
      className="max-w-xl"
    >
      <Card>
        <CardHeader>
          <CardTitle>Add employee</CardTitle>
          <CardDescription>Set salary, payment type, and allowances.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <PayrollEmployeeFormFields formData={formData} setFormData={setFormData} errors={errors} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/app/payroll/employees">Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Add employee"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
