"use client";

import { useRouter } from "next/navigation";
import { BarChart3, Receipt, TrendingUp, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AppPageShell } from "@/components/app-page-shell";

const reportCards = [
  {
    title: "Profit and Loss Report",
    description: "Download your Profit & Loss statement for any period.",
    icon: BarChart3,
    href: "/app/reports",
    locked: false,
  },
  {
    title: "Sales Report",
    description: "View and analyze your sales performance over time.",
    icon: TrendingUp,
    href: "/app/sales-report",
    locked: false,
  },
  {
    title: "Expense Report",
    description: "Track and export your expense breakdown by period.",
    icon: Receipt,
    href: "/app/expense-report",
    locked: false,
  },
];

export default function ReportingsPage() {
  const router = useRouter();

  return (
    <AppPageShell subtitle="Pick profit & loss, sales, or expense reports—each opens in one click.">
      <div className="grid grid-cols-1 gap-6">
        {reportCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className={cn(
                "transition-colors",
                card.locked
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:bg-accent/50 cursor-pointer"
              )}
              onClick={() => !card.locked && card.href && router.push(card.href)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2">
                    {card.title}
                    {card.locked && (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </div>
                <div
                  className={cn(
                    "rounded-lg p-2",
                    card.locked ? "bg-muted" : "bg-primary/10"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      card.locked ? "text-muted-foreground" : "text-primary"
                    )}
                  />
                </div>
              </CardHeader>
              {card.locked && (
                <CardContent>
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </AppPageShell>
  );
}
