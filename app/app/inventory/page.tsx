"use client";

import { useRouter } from "next/navigation";
import { Package, MapPin, Layers, Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const inventoryCards = [
  {
    title: "Products",
    description: "Catalogue items you buy, sell, or stock.",
    icon: Package,
    href: "/app/inventory/products",
    locked: false,
  },
  {
    title: "Locations",
    description: "Warehouses and sites where stock is held.",
    icon: MapPin,
    href: "/app/inventory/locations",
    locked: false,
  },
  {
    title: "Stock Management",
    description: "Movements, levels, and valuation by location.",
    icon: Layers,
    href: "/app/inventory/stock",
    locked: false,
  },
];

export default function InventoryPage() {
  const router = useRouter();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground mt-1">
          Products, storage locations, and stock in one place
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {inventoryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className={cn(
                "transition-colors",
                card.locked
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:bg-accent/50"
              )}
              onClick={() => !card.locked && card.href && router.push(card.href)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {card.title}
                    {card.locked && (
                      <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
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
