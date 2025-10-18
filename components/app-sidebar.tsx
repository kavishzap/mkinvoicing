"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Settings, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import Logo from "../assets/logo.png";
import { toast } from "@/hooks/use-toast";

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

const navItems = [
  { title: "Invoices", href: "/app/invoices", icon: FileText },
  { title: "Customers", href: "/app/customers", icon: Users },
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
      <div className="p-6 shrink-0">
        <Link
          href="/app/invoices"
          className="flex items-center gap-2"
          onClick={onNavigate}
        >
          <Image
            src={Logo}
            alt="PayMoBill Logo"
            width={96}
            height={96}
            className="object-contain w-24 h-24"
            priority
          />
        </Link>
      </div>

      {/* ✅ Menus and Logout grouped together */}
      <nav className="px-3 pb-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

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
    </aside>
  );
}
