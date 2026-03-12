"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, LayoutDashboard, Settings, Users, LogOut, Receipt, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

const navItems = [
  { title: "Dashboard", href: "/app", icon: LayoutDashboard },
  { title: "Invoices", href: "/app/invoices", icon: FileText },
  { title: "Customers", href: "/app/customers", icon: Users },
  { title: "Expenses", href: "/app/expenses", icon: Receipt },
  { title: "Reports", href: "/app/reports", icon: BarChart3 },
  { title: "Settings", href: "/app/settings", icon: Settings },
] as const;

export function AppSidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    toast({
      title: "Confirm Logout",
      description: "Are you sure you want to log out?",
      action: (
        <button
          className="text-red-600 text-sm font-medium ml-auto"
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            router.push("/auth/login");
          }}
        >
          Yes
        </button>
      ),
    });
  };

  return (
    <aside
      className={cn(
        "hidden md:flex w-64 flex-col border-r border-border bg-card",
        className
      )}
    >
      <div className="p-6 pb-4 shrink-0">
        <Link
          href="/app"
          className="flex items-center justify-center"
          onClick={onNavigate}
        >
          <span className="text-xl font-bold tracking-tight">PocketLedger</span>
        </Link>
      </div>

      {/* Menus and Logout */}
      <nav className="px-3 pb-3 space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
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
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-red-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </nav>
      <div className="flex flex-col items-center justify-center mt-4 mb-2">
        <span className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Mojhoa Automations
        </span>
      </div>
    </aside>
  );
}
