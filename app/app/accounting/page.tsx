"use client";

import { useRouter } from "next/navigation";
import { BookOpen, Users, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const accountingCards = [
  {
    title: "Basic Accounting Ledger",
    description: "Track debits, credits, and general ledger entries.",
    icon: BookOpen,
    href: "/app/accounting/basic-ledger",
    locked: false,
  },
  {
    title: "Customer/Supplier Ledger",
    description: "View ledger balances by customer and supplier.",
    icon: Users,
    href: "/app/accounting/customer-supplier-ledger",
    locked: false,
  },
];

export default function AccountingPage() {
  const router = useRouter();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
        <p className="text-muted-foreground mt-1">
          Access accounting ledgers and books
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {accountingCards.map((card) => {
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
    </div>
  );
}
