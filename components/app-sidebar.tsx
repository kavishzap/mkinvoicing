"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FileText, LayoutDashboard, Settings, Users, LogOut, Receipt, BarChart3, Coins, ScrollText, ShoppingCart, Truck, ClipboardList, FileInput, BookOpen, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

const navItems = [
  { title: "Dashboard", href: "/app", icon: LayoutDashboard },
  { title: "Invoices", href: "/app/invoices", icon: FileText },
  { title: "Quotations", href: "/app/quotations", icon: ScrollText },
  { title: "Sales Orders", href: "/app/sales-orders", icon: ShoppingCart },
  { title: "Purchase Orders", href: "/app/purchase-orders", icon: ClipboardList },
  { title: "Purchase Invoices", href: "/app/purchase-invoices", icon: FileInput },
  { title: "Customers", href: "/app/customers", icon: Users },
  { title: "Suppliers", href: "/app/suppliers", icon: Truck },
  { title: "Expenses", href: "/app/expenses", icon: Receipt },
  { title: "Payroll", href: "/app/payroll", icon: Wallet },
  { title: "Customer Credit", href: "/app/customer-credit", icon: Coins },
  { title: "Reportings", href: "/app/reportings", icon: BarChart3 },
  { title: "Accounting", href: "/app/accounting", icon: BookOpen },
  { title: "Company Settings", href: "/app/settings", icon: Settings },
] as const;

export function AppSidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    setLogoutOpen(false);
    router.push("/main");
  };

  return (
    <aside
      className={cn(
        "hidden md:flex w-64 flex-col border-r border-border bg-card min-h-0 overflow-hidden",
        className
      )}
    >
      <div className="p-6 pb-4 shrink-0">
        <Link
          href="/app"
          className="block w-full"
          onClick={onNavigate}
        >
          <Image
            src="/moledger.png"
            alt="MoLedger"
            width={80}
            height={80}
            className="w-full h-auto object-contain"
            priority
          />
        </Link>
      </div>

      {/* Menus and Logout */}
      <nav className="px-3 pb-3 space-y-1 flex-1 min-h-0 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour-id={item.title.replace(/\s+/g, "-").toLowerCase()}
              aria-current={isActive ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.title}</span>
            </Link>
          );
        })}

        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-red-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </nav>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out? You will need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-col items-center justify-center py-4 shrink-0 border-t border-border">
        <span className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} MoLedger
        </span>
      </div>
    </aside>
  );
}
