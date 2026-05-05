import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FileInput,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Package,
  Package2,
  PackageOpen,
  Receipt,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

/** Known feature codes (keep in sync with `public.features.code`). */
export const FEATURE_CODES = {
  dashboard: "dashboard",
  invoices: "invoices",
  quotations: "quotations",
  products: "products",
  salesOrders: "sales_orders",
  purchaseOrders: "purchase_orders",
  purchaseInvoices: "purchase_invoices",
  customers: "customers",
  suppliers: "suppliers",
  locations: "locations",
  expenses: "expenses",
  payroll: "payroll",
  customerCredit: "customer_credit",
  whatsappCatalog: "whatsapp_catalog",
  reporting: "reporting",
  accounting: "accounting",
  companyTeam: "company_team",
  companySettings: "company_settings",
  dataCenter: "data_center",
  deliveryNote: "delivery_note",
  zoneCity: "zone_city",
  inventory: "inventory",
} as const;

export type FeatureCode = (typeof FEATURE_CODES)[keyof typeof FEATURE_CODES];

/** Sidebar section — order follows {@link NAV_SECTION_ORDER}. */
export type NavSectionId =
  | "overview"
  | "sales"
  | "purchasing"
  | "operations"
  | "marketing"
  | "reports"
  | "finance"
  | "company"
  /** Feature codes not listed in {@link APP_NAV_ITEMS} (e.g. payroll, quotations). */
  | "other";

export const NAV_SECTION_ORDER: readonly NavSectionId[] = [
  "overview",
  "sales",
  "purchasing",
  "operations",
  "marketing",
  "reports",
  "finance",
  "company",
  "other",
] as const;

export const NAV_SECTION_LABELS: Record<NavSectionId, string> = {
  overview: "Overview",
  sales: "Sales",
  purchasing: "Purchasing",
  operations: "Operations",
  marketing: "Marketing",
  reports: "Reports & analytics",
  finance: "Finance",
  company: "Company",
  other: "Other",
};

export type AppNavItem = {
  /** Feature code required to view this entry. */
  requires: FeatureCode;
  href: string;
  icon: LucideIcon;
  /** Sidebar group heading for this item. */
  section: NavSectionId;
  /**
   * Optional sub-heading inside the section (e.g. "Delivery" under Operations).
   * Shown before this item when it differs from the previous item's subsection.
   */
  subsection?: string;
};

/**
 * Hardcoded menu labels when `features.name` is not in the user’s role list
 * (lookup only has granted features) or the row is missing — last resort.
 */
export const NAV_LABEL_FALLBACK_BY_HREF: Record<string, string> = {
  "/app": "Dashboard",
  "/app/invoices": "Invoices",
  "/app/quotations": "Quotations",
  "/app/sales-orders": "Sales Orders",
  "/app/purchase-orders": "Purchase Orders",
  "/app/purchase-invoices": "Purchase Invoices",
  "/app/customers": "Customers",
  "/app/suppliers": "Suppliers",
  "/app/inventory": "Inventory",
  "/app/inventory/products": "Products",
  "/app/expenses": "Expenses",
  "/app/payroll": "Payroll",
  "/app/customer-credit": "Customer Credit",
  "/app/whatsapp": "WhatsApp",
  "/app/reportings": "Reporting",
  "/app/accounting": "Accounting",
  "/app/company-team": "Company Team",
  "/app/settings": "Company Settings",
  "/app/data-center": "Data Center",
  "/app/delivery-notes": "Delivery Notes",
  "/app/delivery-notes/zone-cities": "Zone Cities",
};

/**
 * Sidebar label: `public.features.name` for `item.requires` (must match
 * `features.code` in DB), then {@link NAV_LABEL_FALLBACK_BY_HREF}, then code.
 */
export function getNavDisplayLabel(
  item: AppNavItem,
  featureNameFn: (code: string) => string | null,
): string {
  /** Sidebar / shell: main hub uses `inventory` in DB; locations sub-routes use `locations`. */
  if (item.href === "/app/inventory") return "Inventory";
  if (item.href === "/app/inventory/products") return "Products";
  const fromDb = featureNameFn(item.requires)?.trim();
  if (fromDb) return fromDb;
  return NAV_LABEL_FALLBACK_BY_HREF[item.href] ?? item.requires;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    requires: FEATURE_CODES.dashboard,
    href: "/app",
    icon: LayoutDashboard,
    section: "overview",
  },
  {
    requires: FEATURE_CODES.invoices,
    href: "/app/invoices",
    icon: FileText,
    section: "sales",
  },
  {
    requires: FEATURE_CODES.salesOrders,
    href: "/app/sales-orders",
    icon: ShoppingCart,
    section: "sales",
  },
  {
    requires: FEATURE_CODES.customers,
    href: "/app/customers",
    icon: Users,
    section: "sales",
  },
  {
    requires: FEATURE_CODES.purchaseOrders,
    href: "/app/purchase-orders",
    icon: ClipboardList,
    section: "purchasing",
  },
  {
    requires: FEATURE_CODES.purchaseInvoices,
    href: "/app/purchase-invoices",
    icon: FileInput,
    section: "purchasing",
  },
  { requires: FEATURE_CODES.suppliers, href: "/app/suppliers", icon: Truck, section: "purchasing" },
  {
    requires: FEATURE_CODES.products,
    href: "/app/inventory/products",
    icon: Package,
    section: "operations",
  },
  {
    requires: FEATURE_CODES.inventory,
    href: "/app/inventory",
    icon: Package2,
    section: "operations",
  },
  {
    requires: FEATURE_CODES.expenses,
    href: "/app/expenses",
    icon: Receipt,
    section: "operations",
  },
  {
    requires: FEATURE_CODES.deliveryNote,
    href: "/app/delivery-notes",
    icon: PackageOpen,
    section: "operations",
    subsection: "Delivery",
  },
  {
    requires: FEATURE_CODES.zoneCity,
    href: "/app/delivery-notes/zone-cities",
    icon: ScrollText,
    section: "operations",
    subsection: "Delivery",
  },
  {
    requires: FEATURE_CODES.whatsappCatalog,
    href: "/app/whatsapp",
    icon: MessageCircle,
    section: "marketing",
  },
  {
    requires: FEATURE_CODES.reporting,
    href: "/app/reportings",
    icon: BarChart3,
    section: "reports",
  },
  {
    requires: FEATURE_CODES.accounting,
    href: "/app/accounting",
    icon: BookOpen,
    section: "finance",
  },
  {
    requires: FEATURE_CODES.companyTeam,
    href: "/app/company-team",
    icon: UserCog,
    section: "company",
  },
  {
    requires: FEATURE_CODES.companySettings,
    href: "/app/settings",
    icon: Settings,
    section: "company",
  },
  {
    requires: FEATURE_CODES.dataCenter,
    href: "/app/data-center",
    icon: Wallet,
    section: "company",
  },
];

/** Minimal shape for grouping role-form feature checkboxes. */
export type RoleFormFeaturePick = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type RoleFormFeatureRow<
  T extends RoleFormFeaturePick = RoleFormFeaturePick,
> = {
  feature: T;
  /** Order within the app shell nav (lower first). */
  order: number;
  subsection?: string;
};

/**
 * Maps a `features.code` to the same section / order as {@link APP_NAV_ITEMS}.
 * Codes not in the nav (e.g. `payroll`) go to `other`.
 */
export function getNavSectionMetaForFeatureCode(code: string): {
  section: NavSectionId;
  subsection?: string;
  order: number;
} {
  const idx = APP_NAV_ITEMS.findIndex((item) => item.requires === code);
  if (idx >= 0) {
    const item = APP_NAV_ITEMS[idx]!;
    return {
      section: item.section,
      subsection: item.subsection,
      order: idx,
    };
  }
  return { section: "other", order: 10_000 };
}

/**
 * Buckets plan / assignable features under the same headings as the sidebar.
 */
export function groupRoleFormFeaturesByNavSection<T extends RoleFormFeaturePick>(
  features: T[]
): Map<NavSectionId, RoleFormFeatureRow<T>[]> {
  const map = new Map<NavSectionId, RoleFormFeatureRow<T>[]>();
  for (const id of NAV_SECTION_ORDER) {
    map.set(id, []);
  }
  for (const f of features) {
    const meta = getNavSectionMetaForFeatureCode(f.code);
    map.get(meta.section)!.push({
      feature: f,
      order: meta.order,
      subsection: meta.subsection,
    });
  }
  for (const id of NAV_SECTION_ORDER) {
    map.get(id)!.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.feature.name.localeCompare(b.feature.name);
    });
  }
  return map;
}

/**
 * Path-prefix matchers. Order matters: longer / more specific prefixes first.
 * The first matching entry's `requires` determines what feature grants access.
 */
export const ROUTE_FEATURE_MATCHERS: ReadonlyArray<{
  prefix: string;
  requires: FeatureCode;
}> = [
  { prefix: "/app/invoices", requires: FEATURE_CODES.invoices },
  { prefix: "/app/quotations", requires: FEATURE_CODES.quotations },
  { prefix: "/app/sales-orders", requires: FEATURE_CODES.salesOrders },
  { prefix: "/app/purchase-orders", requires: FEATURE_CODES.purchaseOrders },
  {
    prefix: "/app/purchase-invoices",
    requires: FEATURE_CODES.purchaseInvoices,
  },
  { prefix: "/app/customers", requires: FEATURE_CODES.customers },
  { prefix: "/app/suppliers", requires: FEATURE_CODES.suppliers },
  { prefix: "/app/inventory/locations", requires: FEATURE_CODES.locations },
  { prefix: "/app/inventory/products", requires: FEATURE_CODES.products },
  { prefix: "/app/inventory/stock", requires: FEATURE_CODES.inventory },
  { prefix: "/app/inventory", requires: FEATURE_CODES.inventory },
  { prefix: "/app/expenses", requires: FEATURE_CODES.expenses },
  { prefix: "/app/payroll", requires: FEATURE_CODES.payroll },
  { prefix: "/app/customer-credit", requires: FEATURE_CODES.customerCredit },
  { prefix: "/app/whatsapp", requires: FEATURE_CODES.whatsappCatalog },
  { prefix: "/app/reportings", requires: FEATURE_CODES.reporting },
  { prefix: "/app/reports", requires: FEATURE_CODES.reporting },
  { prefix: "/app/sales-report", requires: FEATURE_CODES.reporting },
  { prefix: "/app/expense-report", requires: FEATURE_CODES.reporting },
  { prefix: "/app/accounting", requires: FEATURE_CODES.accounting },
  { prefix: "/app/settings", requires: FEATURE_CODES.companySettings },
  { prefix: "/app/company-team", requires: FEATURE_CODES.companyTeam },
  { prefix: "/app/data-center", requires: FEATURE_CODES.dataCenter },
  { prefix: "/app/delivery-notes/zone-cities", requires: FEATURE_CODES.zoneCity },
  { prefix: "/app/delivery-notes", requires: FEATURE_CODES.deliveryNote },
  { prefix: "/app", requires: FEATURE_CODES.dashboard },
];

export function requiredFeatureForPath(pathname: string): FeatureCode | null {
  for (const m of ROUTE_FEATURE_MATCHERS) {
    if (pathname === m.prefix || pathname.startsWith(m.prefix + "/")) {
      return m.requires;
    }
  }
  return null;
}

/**
 * Human-readable current module title for the app shell (matches sidebar labels).
 */
export function resolveCurrentNavLabel(
  pathname: string,
  featureNameFn: (code: string) => string | null
): string {
  if (
    pathname.startsWith("/app/inventory/products/") &&
    pathname.endsWith("/edit")
  ) {
    return "Edit product";
  }
  if (pathname === "/app/settings/roles/new") {
    return "Create role";
  }
  if (
    pathname.startsWith("/app/settings/roles/") &&
    pathname.endsWith("/edit")
  ) {
    return "Edit role";
  }
  const code = requiredFeatureForPath(pathname);
  if (!code) return "MoLedger";
  const item = APP_NAV_ITEMS.find((i) => i.requires === code);
  if (item) return getNavDisplayLabel(item, featureNameFn);
  return featureNameFn(code) ?? code;
}
