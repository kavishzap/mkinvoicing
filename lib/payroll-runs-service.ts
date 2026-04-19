import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import { addExpense } from "@/lib/expenses-service";
import { getActiveAdvancesForEmployee } from "@/lib/employee-advances-service";
import { updateAdvanceDeducted } from "@/lib/employee-advances-service";

export type PayrollRunRow = {
  id: string;
  user_id: string;
  month: number;
  year: number;
  status: "draft" | "processed";
  total_gross: number;
  total_deductions: number;
  total_net: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type PayslipRow = {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  basic_salary: number;
  transport_allowance: number;
  other_allowance: number;
  gross_salary: number;
  advance_deduction: number;
  absence_deduction: number;
  other_deduction: number;
  total_deductions: number;
  net_salary: number;
  payment_status: "unpaid" | "paid";
  payment_method: string | null;
  payment_date: string | null;
  expense_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PayslipWithEmployee = PayslipRow & {
  employee: { full_name: string; position: string | null };
};

export type PayrollRunWithPayslips = PayrollRunRow & {
  payslips: PayslipWithEmployee[];
};

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function listPayrollRuns(opts?: {
  year?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: PayrollRunRow[]; total: number }> {
  const companyId = await requireActiveCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 20);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("payroll_runs")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .range(from, to);

  if (opts?.year) {
    q = q.eq("year", opts.year);
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map(mapRun),
    total: count ?? 0,
  };
}

export async function getPayrollRun(id: string): Promise<PayrollRunWithPayslips | null> {
  const companyId = await requireActiveCompanyId();
  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .single();

  if (runError || !run) return null;

  const { data: payslips, error: psError } = await supabase
    .from("payslips")
    .select(`
      *,
      employee:employees(full_name, position)
    `)
    .eq("payroll_run_id", id)
    .order("employee(full_name)", { ascending: true });

  if (psError) throw psError;

  const mappedPayslips: PayslipWithEmployee[] = (payslips ?? []).map((p: any) => {
    const emp = p.employee ?? p.employees;
    return {
      ...mapPayslip(p),
      employee: {
        full_name: emp?.full_name ?? "Unknown",
        position: emp?.position ?? null,
      },
    };
  });

  return {
    ...mapRun(run),
    payslips: mappedPayslips,
  };
}

export async function runPayroll(month: number, year: number): Promise<PayrollRunWithPayslips> {
  const [userId, companyId] = await Promise.all([
    getUserId(),
    requireActiveCompanyId(),
  ]);

  const { data: existing } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("company_id", companyId)
    .eq("month", month)
    .eq("year", year)
    .single();

  if (existing) throw new Error(`Payroll for ${getMonthName(month)} ${year} already exists`);

  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, full_name, basic_salary, transport_allowance, other_allowance, currency")
    .eq("company_id", companyId)
    .eq("status", "active");

  if (empErr) throw empErr;

  if (!employees?.length) throw new Error("No active employees. Add employees first.");

  const currency = employees[0]?.currency ?? "MUR";

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .insert({
      user_id: userId,
      company_id: companyId,
      month,
      year,
      status: "processed",
      total_gross: 0,
      total_deductions: 0,
      total_net: 0,
      currency,
    })
    .select("*")
    .single();

  if (runError) throw runError;
  const payrollRun = mapRun(run);

  let totalGross = 0;
  let totalDeductions = 0;

  const payslipInserts: Record<string, unknown>[] = [];
  const employeeAdvanceUpdates = new Map<string, { advanceId: string; amount: number }[]>();

  for (const emp of employees) {
    const basic = Number(emp.basic_salary ?? 0);
    const transport = Number(emp.transport_allowance ?? 0);
    const other = Number(emp.other_allowance ?? 0);
    const gross = basic + transport + other;

    const advances = await getActiveAdvancesForEmployee(emp.id);
    let advanceDeduction = 0;
    const updates: { advanceId: string; amount: number }[] = [];

    for (const adv of advances) {
      const remaining = adv.amount - adv.amount_deducted;
      const toDeduct = Math.min(adv.deduction_per_period, remaining);
      if (toDeduct > 0) {
        advanceDeduction += toDeduct;
        updates.push({ advanceId: adv.id, amount: toDeduct });
      }
    }
    if (updates.length) employeeAdvanceUpdates.set(emp.id, updates);

    const absenceDeduction = 0;
    const otherDeduction = 0;
    const totalDed = advanceDeduction + absenceDeduction + otherDeduction;
    const net = Math.max(0, gross - totalDed);

    totalGross += gross;
    totalDeductions += totalDed;

    payslipInserts.push({
      payroll_run_id: payrollRun.id,
      company_id: companyId,
      employee_id: emp.id,
      basic_salary: basic,
      transport_allowance: transport,
      other_allowance: other,
      gross_salary: gross,
      advance_deduction: advanceDeduction,
      absence_deduction: absenceDeduction,
      other_deduction: otherDeduction,
      total_deductions: totalDed,
      net_salary: net,
      payment_status: "unpaid",
    });
  }

  const { data: insertedPayslips, error: psError } = await supabase
    .from("payslips")
    .insert(payslipInserts)
    .select("id, employee_id, advance_deduction");

  if (psError) {
    await supabase.from("payroll_runs").delete().eq("id", payrollRun.id);
    throw psError;
  }

  for (const ps of insertedPayslips ?? []) {
    const updates = employeeAdvanceUpdates.get(ps.employee_id);
    if (!updates) continue;
    for (const u of updates) {
      await updateAdvanceDeducted(u.advanceId, u.amount);
      await supabase.from("payslip_advance_deductions").insert({
        payslip_id: ps.id,
        company_id: companyId,
        advance_id: u.advanceId,
        amount: u.amount,
      });
    }
  }

  const totalNet = totalGross - totalDeductions;
  await supabase
    .from("payroll_runs")
    .update({
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_net: totalNet,
    })
    .eq("id", payrollRun.id)
    .eq("company_id", companyId);

  const result = await getPayrollRun(payrollRun.id);
  if (!result) throw new Error("Failed to load payroll run");
  return result;
}

export async function markPayslipPaid(
  payslipId: string,
  params: {
    payment_method: "Cash" | "Card Payment" | "Bank Transfer";
    payment_date: string;
    create_expense?: boolean;
  }
): Promise<void> {
  const companyId = await requireActiveCompanyId();

  const { data: payslip, error: psErr } = await supabase
    .from("payslips")
    .select(`
      *,
      payroll_run:payroll_runs(month, year, company_id),
      employee:employees(full_name)
    `)
    .eq("id", payslipId)
    .eq("company_id", companyId)
    .single();

  if (psErr || !payslip) throw new Error("Payslip not found");
  const pr = payslip.payroll_run as { company_id?: string };
  if (pr?.company_id !== companyId) throw new Error("Not authorized");

  let expenseId: string | null = null;
  if (params.create_expense !== false) {
    const emp = payslip.employee as { full_name?: string };
    const monthName = getMonthName((payslip.payroll_run as { month?: number })?.month ?? 1);
    const year = (payslip.payroll_run as { year?: number })?.year ?? new Date().getFullYear();
    const expense = await addExpense({
      description: `Salary - ${emp?.full_name ?? "Employee"} - ${monthName} ${year}`,
      amount: Number(payslip.net_salary ?? 0),
      currency: "MUR",
      expense_date: params.payment_date,
      line_items: [],
    });
    expenseId = expense.id;
  }

  const { error: updateErr } = await supabase
    .from("payslips")
    .update({
      payment_status: "paid",
      payment_method: params.payment_method,
      payment_date: params.payment_date,
      expense_id: expenseId,
    })
    .eq("id", payslipId)
    .eq("company_id", companyId);

  if (updateErr) throw updateErr;
}

function mapRun(r: Record<string, unknown>): PayrollRunRow {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    month: Number(r.month ?? 0),
    year: Number(r.year ?? 0),
    status: (r.status as "draft" | "processed") ?? "processed",
    total_gross: Number(r.total_gross ?? 0),
    total_deductions: Number(r.total_deductions ?? 0),
    total_net: Number(r.total_net ?? 0),
    currency: (r.currency as string) ?? "MUR",
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function mapPayslip(p: Record<string, unknown>): PayslipRow {
  return {
    id: p.id as string,
    payroll_run_id: p.payroll_run_id as string,
    employee_id: p.employee_id as string,
    basic_salary: Number(p.basic_salary ?? 0),
    transport_allowance: Number(p.transport_allowance ?? 0),
    other_allowance: Number(p.other_allowance ?? 0),
    gross_salary: Number(p.gross_salary ?? 0),
    advance_deduction: Number(p.advance_deduction ?? 0),
    absence_deduction: Number(p.absence_deduction ?? 0),
    other_deduction: Number(p.other_deduction ?? 0),
    total_deductions: Number(p.total_deductions ?? 0),
    net_salary: Number(p.net_salary ?? 0),
    payment_status: (p.payment_status as "unpaid" | "paid") ?? "unpaid",
    payment_method: (p.payment_method as string) ?? null,
    payment_date: (p.payment_date as string) ?? null,
    expense_id: (p.expense_id as string) ?? null,
    notes: (p.notes as string) ?? null,
    created_at: p.created_at as string,
    updated_at: p.updated_at as string,
  };
}

function getMonthName(m: number): string {
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return names[Math.max(0, m - 1)] ?? "";
}
