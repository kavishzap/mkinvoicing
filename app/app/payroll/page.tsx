"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPayrollRuns } from "@/lib/payroll-runs-service";
import { AppPageShell } from "@/components/app-page-shell";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "MUR" }).format(amount);
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function PayrollPage() {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<{ month: number; year: number; total_net: number; id: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { rows } = await listPayrollRuns({ pageSize: 5 });
        setRuns(rows.map((r) => ({ month: r.month, year: r.year, total_net: r.total_net, id: r.id })));
      } catch {
        setRuns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppPageShell subtitle="Maintain your team here, then run monthly payroll and payslips from the same area.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link href="/app/payroll/employees">
          <Card className="hover:bg-accent/30 cursor-pointer transition-colors h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employees
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Add and manage employees, salary setup, and advances
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/app/payroll/runs">
          <Card className="hover:bg-accent/30 cursor-pointer transition-colors h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Run Payroll
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Process monthly payroll, generate payslips, mark as paid
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payroll Runs</CardTitle>
          <CardDescription>Latest processed payroll periods</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No payroll runs yet. Add employees and run payroll from the Run Payroll page.
            </p>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <Link key={r.id} href={`/app/payroll/runs/${r.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50">
                    <span className="font-medium">
                      {MONTH_NAMES[r.month - 1]} {r.year}
                    </span>
                    <span className="text-muted-foreground">{formatCurrency(r.total_net)}</span>
                  </div>
                </Link>
              ))}
              <Button variant="ghost" className="w-full mt-2" asChild>
                <Link href="/app/payroll/runs">View all</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
