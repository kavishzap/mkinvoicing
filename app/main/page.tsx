"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Zap,
  Shield,
  Layers,
  BarChart3,
  Check,
  X,
  Menu,
  CircleUser,
  Users,
  Mail,
  FileText,
  Receipt,
  ScrollText,
  ShoppingCart,
  ClipboardList,
  FileInput,
  Truck,
  Wallet,
  BookOpen,
  Package,
  Building2,
  ShoppingBag,
  Palette,
  Sparkles,
  LayoutGrid,
  Globe,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LoginModal } from "@/components/login-modal";
import { PrivacyPolicyModal, TermsOfServiceModal } from "@/components/moledger-legal-modals";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from "@/components/ui/sheet";

const CYAN = "#00f2ff";

/** WhatsApp chat link; local 59182520 with Mauritius country code +230 */
const WHATSAPP_CHAT_HREF = "https://wa.me/23055063356";
const WHATSAPP_SECOND_HREF = "https://wa.me/23057833020";
const SUPPORT_EMAIL = "moledgersupport@gmail.com";
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

const footerMutedLinkClass =
  "rounded-sm text-sm text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00f2ff]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060a]";

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const faqs = [
  { q: "How do I get started with MoLedger?", a: "Sign up for a free trial. No credit card required. You can import your data and start invoicing within minutes." },
  { q: "Is my data secure?", a: "We use industry-standard encryption and host on secure cloud infrastructure. Your data is backed up and protected." },
  { q: "Can I upgrade or downgrade my plan?", a: "Yes. You can change your plan anytime. Billing is prorated when you upgrade." },
  { q: "What payment methods do you accept?", a: "We accept major credit cards, debit cards, and bank transfers for subscription payments." },
  { q: "Can I customize my invoices and add my company logo?", a: "Yes. In Company Settings you can upload your logo, set bank details, and configure invoice defaults. Invoices support your branding and export to PDF." },
  { q: "Can I convert a quotation to a sales order?", a: "Yes. Once a client accepts your quote, you can convert it to a sales order in one click and manage the order through to delivery." },
  { q: "How does the purchase flow work?", a: "Create purchase orders to suppliers, then record purchase invoices when bills arrive. You can match invoices to orders and track outstanding amounts." },
  { q: "Does MoLedger support payroll?", a: "Yes, on the Pro plan. Add employees, generate payslips, and track salary expenses. Payroll integrates with your expense and reporting data." },
  { q: "Can I track inventory and stock levels?", a: "Yes. Products & Categories let you organise items, and Stock Management tracks levels, low-stock alerts, and movements across your business." },
  { q: "What reports are available?", a: "Sales reports, expense reports, Profit & Loss, and more. Reports can be exported to PDF. Advanced reporting is included in Business and Pro plans." },
];

const features = [
  { icon: FileText, title: "Invoices", desc: "Create professional invoices, track payments & export PDFs" },
  {
    icon: Users,
    title: "Customers & suppliers",
    desc: "Manage customer records for invoices & quotations and supplier details for purchase orders & procurement",
  },
  { icon: Receipt, title: "Expenses", desc: "Track every business expense with line-item detail" },
  { icon: BarChart3, title: "Reports", desc: "Sales, expense & Profit & Loss reports with PDF export" },
  { icon: ScrollText, title: "Quotations", desc: "Send quotes to clients and convert them to orders" },
  { icon: ShoppingCart, title: "Sales Orders", desc: "Manage orders from quote to delivery" },
  { icon: ClipboardList, title: "Purchase Orders", desc: "Create and track purchase orders to suppliers" },
  { icon: FileInput, title: "Purchase Invoices", desc: "Record supplier bills and match to purchase orders" },
  { icon: Wallet, title: "Payroll", desc: "Employee management, payslips & salary expense tracking" },
  { icon: BookOpen, title: "Full Accounting", desc: "Basic ledger, customer/supplier ledger & P&L" },
  { icon: Package, title: "Products & Categories", desc: "Organise products by category for invoices & stock" },
  { icon: Layers, title: "Stock Management", desc: "Track inventory levels, low-stock alerts & movements" },
];

const customServices = [
  {
    key: "portfolio",
    title: "Custom Portfolio",
    desc: "A tailored web presence that showcases your brand, services, and contact details—built to match your identity and ready to link from invoices, quotes, and email signatures.",
    media: { type: "icon" as const, icon: Building2 },
    highlights: [
      { icon: Palette, label: "Brand & visuals" },
      { icon: Sparkles, label: "Polished UX" },
      { icon: LayoutGrid, label: "Flexible layouts" },
    ],
  },
  {
    key: "pos",
    title: "POS System",
    desc: "Purpose-built point-of-sale for counter and retail: fast checkout, receipts, and product lines that stay in sync with how you already run MoLedger.",
    media: {
      type: "image" as const,
      src: "/pos-custom-service.png",
      alt: "",
    },
    highlights: [
      { icon: Zap, label: "Fast checkout" },
      { icon: Receipt, label: "Digital receipts" },
      { icon: Cpu, label: "Hardware-ready" },
    ],
  },
  {
    key: "ecommerce",
    title: "E‑commerce Platform",
    desc: "Sell online with a store that fits your catalogue and checkout flow—payments, fulfilment, and catalogue tools aligned with your operations.",
    media: { type: "icon" as const, icon: ShoppingBag },
    highlights: [
      { icon: ShoppingCart, label: "Checkout & cart" },
      { icon: Truck, label: "Fulfilment" },
      { icon: Globe, label: "Your online store" },
    ],
    included: "Custom Portfolio",
  },
] as const;

const PRICING_PLANS = [
  {
    name: "Starter",
    monthly: 750,
    badge: null as string | null,
    includes: [
      "Dashboard",
      "Invoices & PDF export",
      "Customers",
      "Expenses",
      "Basic reports",
      "Company profile, logo & bank on invoices",
    ],
    excludes: ["Quotations & orders", "Purchasing, suppliers & stock", "Payroll & full accounting"],
  },
  {
    name: "Business",
    monthly: 1000,
    badge: "Most Popular",
    includes: [
      "Everything in Starter",
      "Quotations",
      "Sales & purchase orders",
      "Purchase orders & purchase invoices",
      "Suppliers",
      "Products, categories & stock management",
      "Advanced reporting",
    ],
    excludes: ["Payroll", "Full accounting"],
  },
  {
    name: "Pro",
    monthly: 1500,
    badge: "Full System",
    includes: ["Everything in Business", "Payroll & payslips", "Full accounting (ledgers & P&L)", "Priority support"],
    excludes: [] as string[],
  },
] as const;

export default function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(1);
  const pricing = PRICING_PLANS.map((plan) => ({
    ...plan,
    price: annual ? Math.round(plan.monthly * 0.9) : plan.monthly,
  }));

  return (
    <div className="min-h-dvh w-full max-w-[100vw] bg-[#06060a] text-white antialiased overflow-x-clip">
      {/* Header: fixed so it stays visible (sticky breaks when ancestors use overflow) */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-white/[0.04] bg-[#06060a]/25 backdrop-blur-sm supports-[backdrop-filter]:bg-[#06060a]/20">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/main" className="flex items-center shrink-0">
            <Image
              src="/logo2.png"
              alt="MoLedger"
              width={120}
              height={120}
              className="h-9 w-auto object-contain sm:h-10 sm:w-auto"
            />
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 shrink min-w-0">
            <a href="#features" className="rounded-full px-3 py-2 text-sm font-medium text-white/75 hover:text-white transition-colors">Features</a>
            <a href="#custom-services" className="rounded-full px-3 py-2 text-sm font-medium text-white/75 hover:text-white transition-colors">Services</a>
            <a href="#pricing" className="rounded-full px-3 py-2 text-sm font-medium text-white/75 hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="rounded-full px-3 py-2 text-sm font-medium text-white/75 hover:text-white transition-colors">FAQ</a>
            <a
              href={WHATSAPP_CHAT_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-[#00f2ff] text-zinc-950 shadow-md shadow-cyan-500/15 hover:bg-[#5ff5ff] transition-colors whitespace-nowrap"
              aria-label="Get started on WhatsApp"
            >
              Get started
              <WhatsAppGlyph className="h-4 w-4 text-[#128C7E]" />
            </a>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/90 hover:bg-white/12 hover:text-white transition-colors"
              aria-label="Log in"
            >
              <CircleUser className="h-[1.35rem] w-[1.35rem]" strokeWidth={1.75} />
            </button>
          </nav>
          {/* Mobile: log in + menu */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 hover:bg-white/10 transition-colors"
              aria-label="Log in"
            >
              <CircleUser className="h-[1.35rem] w-[1.35rem]" strokeWidth={1.75} />
            </button>
            <Sheet>
            <SheetTrigger asChild>
              <button type="button" className="p-2 rounded-full text-white/90 hover:bg-white/10 transition-colors" aria-label="Open menu">
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex h-full w-full max-w-xs flex-col border-white/10 bg-[#0d0d12] p-0 [&>button]:text-white"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-8 pt-14">
                <SheetClose asChild>
                  <Link
                    href="/main"
                    className="mb-5 inline-flex items-center rounded-xl px-1 py-2 -mx-1 transition-colors hover:bg-white/[0.06]"
                    aria-label="MoLedger home"
                  >
                    <Image
                      src="/logo2.png"
                      alt=""
                      width={140}
                      height={140}
                      className="h-12 w-auto object-contain"
                    />
                  </Link>
                </SheetClose>
                <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
                  <SheetClose asChild>
                    <a href="#features" className="block rounded-xl px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/5">
                      Features
                    </a>
                  </SheetClose>
                  <SheetClose asChild>
                    <a href="#custom-services" className="block rounded-xl px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/5">
                      Services
                    </a>
                  </SheetClose>
                  <SheetClose asChild>
                    <a href="#pricing" className="block rounded-xl px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/5">
                      Pricing
                    </a>
                  </SheetClose>
                  <SheetClose asChild>
                    <a href="#faq" className="block rounded-xl px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/5">
                      FAQ
                    </a>
                  </SheetClose>
                  <SheetClose asChild>
                    <a
                      href={WHATSAPP_CHAT_HREF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-sm font-semibold leading-snug bg-[#00f2ff] text-zinc-950 transition-colors hover:bg-[#5ff5ff]"
                      aria-label="Get started on WhatsApp"
                    >
                      Get started
                      <WhatsAppGlyph className="h-5 w-5 text-[#128C7E]" />
                    </a>
                  </SheetClose>
                </nav>
                <div
                  className="my-6 h-px w-full shrink-0 bg-gradient-to-r from-transparent via-white/[0.14] to-transparent"
                  role="separator"
                />
                <div className="mt-auto">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Contact</p>
                  <ul className="mt-3 flex flex-col gap-3 text-sm">
                    <li>
                      <a
                        href={WHATSAPP_CHAT_HREF}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-white/70 transition-colors hover:text-[#25D366]"
                      >
                        <WhatsAppGlyph className="h-4 w-4 shrink-0 text-[#25D366]" />
                        <span>+230 5506 3356</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href={WHATSAPP_SECOND_HREF}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-white/70 transition-colors hover:text-[#25D366]"
                      >
                        <WhatsAppGlyph className="h-4 w-4 shrink-0 text-[#25D366]" />
                        <span>+230 5783 3020</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href={SUPPORT_MAILTO}
                        className="inline-flex items-center gap-2 break-all text-white/70 transition-colors hover:text-[#00f2ff]"
                      >
                        <Mail className="h-4 w-4 shrink-0 text-[#00f2ff]/80" aria-hidden />
                        <span>{SUPPORT_EMAIL}</span>
                      </a>
                    </li>
                  </ul>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href={SUPPORT_MAILTO}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition-colors hover:border-[#00f2ff]/35 hover:text-[#00f2ff]"
                      aria-label={`Email ${SUPPORT_EMAIL}`}
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                    <a
                      href={WHATSAPP_CHAT_HREF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition-colors hover:border-[#25D366]/40 hover:text-[#25D366]"
                      aria-label="WhatsApp MoLedger"
                    >
                      <WhatsAppGlyph className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero: 100svh media clip + solid continuation; matches html/body min-height dvh */}
      <section
        aria-labelledby="hero-heading"
        className="relative isolate min-h-[100svh] w-full max-w-[100vw] bg-[#06060a] overflow-x-clip"
      >
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-0 h-[100svh] w-full max-w-[100vw] overflow-hidden"
          aria-hidden
        >
          <div className="relative z-0 h-full min-h-[100svh] w-full">
            <Image
              src="/hero.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              draggable={false}
              className="pointer-events-none object-cover object-center select-none"
            />
          </div>
          <div className="absolute inset-0 z-[1] bg-zinc-950/72" />
          <div className="absolute inset-0 z-[1] bg-gradient-to-b from-zinc-950/40 via-zinc-950/62 to-zinc-950/88" />
          <div className="absolute inset-0 z-[1] bg-gradient-to-tr from-[#00f2ff]/[0.04] via-transparent to-transparent" />
        </div>
        <div
          className="pointer-events-none absolute left-0 right-0 top-[100svh] bottom-0 z-0 bg-[#06060a]"
          aria-hidden
        />

        <div className="relative z-10 box-border flex min-h-[100svh] flex-col items-center justify-center px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-20">
          <div className="mx-auto w-full max-w-2xl text-center sm:max-w-3xl">
            <p className="mb-4 sm:mb-5 inline-flex max-w-[95vw] flex-wrap items-center justify-center rounded-full border border-white/10 bg-zinc-950/50 px-3 py-1.5 text-[0.6875rem] sm:text-xs font-medium tracking-wide text-white/90">
              Invoicing, Expenses &amp; Accounting — One Platform
            </p>
            <h1 id="hero-heading" className="text-3xl sm:text-4xl lg:text-[2.5rem] font-bold tracking-tight text-white mb-4 sm:mb-5 leading-snug [text-shadow:0_2px_20px_rgba(0,0,0,0.4)]">
              Everything your business needs,
              <br />
              in one place.
            </h1>
            <p className="text-base sm:text-lg text-white/75 mb-8 sm:mb-10 max-w-lg mx-auto leading-relaxed [text-shadow:0_1px_12px_rgba(0,0,0,0.3)]">
              MoLedger gives you full control with simple workflows, clear reporting, and tools that scale with you.
            </p>
            <div className="mb-10 sm:mb-12 flex max-w-sm flex-col items-stretch justify-center gap-3 sm:mx-auto sm:max-w-none sm:flex-row sm:items-center">
              <a
                href={WHATSAPP_CHAT_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold bg-[#00f2ff] text-zinc-950 shadow-lg shadow-cyan-500/20 hover:bg-[#5ff5ff] transition-colors sm:h-11 sm:px-7"
                aria-label="Get started on WhatsApp"
              >
                Get started
                <WhatsAppGlyph className="h-[1.125rem] w-[1.125rem] text-[#128C7E] sm:h-5 sm:w-5" />
              </a>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="h-11 shrink-0 rounded-full px-6 text-sm font-medium text-white border border-white/25 bg-zinc-950/35 hover:bg-zinc-900/55 hover:border-white/35 transition-colors sm:px-7"
              >
                Log in
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-6 text-white/55 text-sm font-medium sm:mt-4 sm:gap-12">
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4 shrink-0" aria-hidden />
                Easy integration
              </span>
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 shrink-0" aria-hidden />
                Secure
              </span>
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
                Real-time reports
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section
        id="features"
        className="scroll-mt-24 sm:scroll-mt-28 relative overflow-hidden bg-landing-pattern px-4 py-20 sm:px-6 sm:py-24 md:py-28"
      >
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-0 h-48 w-[min(36rem,85vw)] -translate-x-1/2 rounded-full bg-[#00f2ff]/[0.12] blur-xl"
          aria-hidden
        />
        <div className="container relative z-10 mx-auto max-w-5xl">
          {/* <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <div className="rounded-2xl border border-white/10 bg-[#0d0d12]/95 p-6 sm:p-8 md:p-10 hover:border-[#00f2ff]/30 transition-colors">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: "rgba(0,242,255,0.15)" }}>
                <Zap className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: CYAN }} />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-3 sm:mb-4">Work smarter, not harder</h3>
              <p className="text-base text-white/70 mb-6 sm:mb-8 leading-relaxed">
                Automate invoicing, track expenses, and get real-time reports. One platform for your entire business.
              </p>
              <Button className="rounded-full bg-[#0d1624] border-2 border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/10 px-6" asChild>
                <a href={WHATSAPP_CHAT_HREF} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2">
                  Get started
                  <WhatsAppGlyph className="h-4 w-4 text-[#25D366]" />
                </a>
              </Button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0d0d12]/95 p-6 sm:p-8 md:p-10 hover:border-[#00f2ff]/30 transition-colors">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: "rgba(0,242,255,0.15)" }}>
                <Shield className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: CYAN }} />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-3 sm:mb-4">Sleep easy, we&apos;ve got your back</h3>
              <p className="text-base text-white/70 mb-6 sm:mb-8 leading-relaxed">
                Secure, reliable, and built for SMEs. Your data is protected and always available.
              </p>
              <button
                type="button"
                onClick={() => document.getElementById("feature-list")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="rounded-full px-6 py-3 text-sm font-medium bg-[#0d1624] border-2 border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/10 transition"
              >
                See benefits
              </button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0d0d12]/95 p-6 sm:p-8 md:p-10 hover:border-[#00f2ff]/30 transition-colors sm:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: "rgba(0,242,255,0.15)" }}>
                <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: CYAN }} />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-3 sm:mb-4">Grow with clarity</h3>
              <p className="text-base text-white/70 mb-6 sm:mb-8 leading-relaxed">
                Sales, expenses, profit and loss — see exactly how your business is performing with powerful reports and insights.
              </p>
              <Button className="rounded-full bg-[#0d1624] border-2 border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/10 px-6" asChild>
                <a href={WHATSAPP_CHAT_HREF} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2">
                  Get started
                  <WhatsAppGlyph className="h-4 w-4 text-[#25D366]" />
                </a>
              </Button>
            </div>
          </div> */}

          <div id="feature-list" className="scroll-mt-24 sm:scroll-mt-28">
            <header className="mx-auto mb-10 max-w-3xl text-center sm:mb-12 md:mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl">
                Everything you need
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/65 sm:mt-5 sm:text-lg">
                From invoicing to payroll, from stock to accounting — MoLedger grows with your business.
              </p>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-white/10 bg-[#0d0d12] p-5 transition-colors hover:border-[#00f2ff]/30 sm:p-6"
                >
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-full sm:mb-3.5 sm:h-11 sm:w-11"
                    style={{ backgroundColor: "rgba(0,242,255,0.18)" }}
                  >
                    <f.icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" style={{ color: CYAN }} aria-hidden />
                  </div>
                  <h3 className="mb-1.5 text-base font-semibold tracking-tight text-white sm:mb-2 sm:text-lg">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/60 sm:text-[0.9375rem]">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="scroll-mt-24 sm:scroll-mt-28 relative overflow-x-clip overflow-y-visible bg-landing-pattern px-4 py-20 sm:px-6 sm:py-24 md:py-28"
      >
        <div className="container relative z-10 mx-auto max-w-5xl">
          <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-10 md:mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl">
              Flexible pricing for teams of all sizes
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/65 sm:mt-5 sm:text-lg">
              Choose monthly or annual billing. Annual plans save 10%.
            </p>
          </header>
          <div className="mb-7 flex flex-wrap items-center justify-center gap-3 sm:mb-9 sm:gap-4 md:mb-10">
            <span className={`text-sm ${!annual ? "text-white" : "text-white/50"}`}>Monthly</span>
            <Switch checked={annual} onCheckedChange={setAnnual} className="data-[state=checked]:bg-[#00f2ff]" />
            <span className={`text-sm ${annual ? "text-white" : "text-white/50"}`}>Annual</span>
            <span className="text-sm font-bold text-[#00f2ff]">Save 10%</span>
          </div>
          <div className="grid gap-4 overflow-visible p-1 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {pricing.map((plan, i) => {
              const selected = selectedPlanIndex === i;
              return (
                <div
                  key={plan.name}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`${plan.name} plan${selected ? ", selected" : ""}`}
                  onClick={() => setSelectedPlanIndex(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedPlanIndex(i);
                    }
                  }}
                  className={`relative flex cursor-pointer flex-col rounded-2xl p-6 transition-all duration-200 ease-out sm:p-8 ${
                    selected
                      ? "z-[1] scale-[1.02] border-2 bg-gradient-to-b from-[#00f2ff]/[0.12] to-[#0d0d12] shadow-[0_0_32px_-8px_rgba(0,242,255,0.35)] hover:scale-[1.03]"
                      : "border border-white/10 bg-[#0d0d12] hover:scale-[1.02] hover:border-white/20"
                  }`}
                  style={selected ? { borderColor: CYAN } : undefined}
                >
                  {plan.badge === "Most Popular" && selected && (
                    <div
                      className="absolute -top-3 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full"
                      style={{ backgroundColor: "#facc15" }}
                      aria-hidden
                    >
                      <Zap className="h-5 w-5 text-black" />
                    </div>
                  )}
                  <h3 className="mb-2 text-xl font-bold tracking-tight">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">Rs {plan.price}</span>
                    <span className="text-sm text-white/50"> / month</span>
                    {annual ? (
                      <p className="mt-1 text-xs text-white/45">Equivalent when billed annually (10% off)</p>
                    ) : null}
                  </div>
                  <ul className="flex-1 space-y-3">
                    {plan.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: CYAN }} aria-hidden />
                        <span className="text-sm text-white/90">{item}</span>
                      </li>
                    ))}
                    {plan.excludes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-white/40">
                        <X className="mt-0.5 h-5 w-5 shrink-0 opacity-50" aria-hidden />
                        <span className="text-sm line-through">{item}</span>
                      </li>
                    ))}
                  </ul>
                  {selected ? (
                    <Button
                      className="mt-8 w-full rounded-full border-0 bg-[#00f2ff] text-black hover:bg-[#5ff5ff]"
                      size="lg"
                      asChild
                    >
                      <a
                        href={WHATSAPP_CHAT_HREF}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2"
                        aria-label={`Get started on WhatsApp with ${plan.name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Get started
                        <WhatsAppGlyph className="h-5 w-5 text-[#128C7E]" />
                      </a>
                    </Button>
                  ) : (
                    <div className="mt-8 h-11 sm:h-12" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Custom services */}
      <section
        id="custom-services"
        className="scroll-mt-24 sm:scroll-mt-28 relative overflow-hidden border-t border-white/[0.06] bg-landing-pattern px-4 py-20 sm:px-6 sm:py-24 md:py-28"
      >
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-0 h-40 w-[min(32rem,80vw)] -translate-x-1/2 rounded-full bg-[#00f2ff]/[0.08] blur-xl"
          aria-hidden
        />
        <div className="container relative z-10 mx-auto max-w-5xl">
          <header className="mx-auto mb-10 max-w-3xl text-center sm:mb-12 md:mb-14">
            <h2 className="text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl">
              Custom services provided
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/65 sm:mt-5 sm:text-lg">
              Beyond the core platform—we design and deliver bespoke solutions that plug into how you work.
            </p>
          </header>
          <div className="grid gap-7 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-10 lg:items-stretch">
            {customServices.map((item) => {
              const CardIcon = item.media.type === "icon" ? item.media.icon : null;
              const includedText = "included" in item ? item.included : null;
              return (
                <article
                  key={item.key}
                  className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d12] shadow-xl shadow-black/40 transition-colors hover:border-[#00f2ff]/22 sm:rounded-3xl"
                >
                  <div
                    className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl sm:rounded-3xl"
                    aria-hidden
                  >
                    {item.media.type === "image" ? (
                      <>
                        {/*
                          POS backdrop: CSS background (not next/image fill) so the layer always paints;
                          sharp asset with scrims so foreground copy stays readable.
                        */}
                        <div className="absolute inset-0 overflow-hidden rounded-2xl sm:rounded-3xl">
                          <div
                            className="absolute left-1/2 top-[58%] h-[min(132%,28rem)] w-[min(132%,28rem)] -translate-x-1/2 -translate-y-1/2 sm:h-[min(140%,32rem)] sm:w-[min(140%,32rem)] sm:top-[55%]"
                            style={{
                              backgroundImage: `url("${item.media.src}")`,
                              backgroundSize: "contain",
                              backgroundPosition: "center center",
                              backgroundRepeat: "no-repeat",
                              opacity: 0.65,
                              filter:
                                "drop-shadow(0 28px 48px rgba(0,0,0,0.72)) drop-shadow(0 12px 24px rgba(0,0,0,0.45)) drop-shadow(0 0 40px rgba(0,242,255,0.2))",
                              WebkitFilter:
                                "drop-shadow(0 28px 48px rgba(0,0,0,0.72)) drop-shadow(0 12px 24px rgba(0,0,0,0.45)) drop-shadow(0 0 40px rgba(0,242,255,0.2))",
                            }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-[#0d0d12]/50" />
                        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d12]/68 via-[#0d0d12]/42 to-[#0d0d12]/78" />
                      </>
                    ) : (
                      CardIcon && (
                        <>
                          {/* Blur on a wrapper so the SVG paints a visible glow; icon scaled up inside padded bounds */}
                          <div className="absolute inset-0 flex items-center justify-center overflow-visible p-4">
                            <div
                              className="flex text-[#00f2ff] opacity-[0.42] sm:opacity-[0.38]"
                              style={{
                                filter: "blur(28px)",
                                transform: "scale(2.25)",
                                transformOrigin: "center center",
                              }}
                            >
                              <CardIcon className="h-36 w-36 shrink-0 sm:h-44 sm:w-44" strokeWidth={1.2} aria-hidden />
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-[#0a0a0f]/68" />
                          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d12]/40 via-[#0d0d12]/72 to-[#0d0d12]/90" />
                        </>
                      )
                    )}
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />
                  </div>
                  <div className="relative z-10 flex flex-1 flex-col p-7 sm:p-8 lg:p-9">
                    <h3 className="text-lg font-bold leading-snug tracking-tight text-white drop-shadow-sm">{item.title}</h3>
                    <p className="mt-6 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42 drop-shadow-sm">
                      Highlights
                    </p>
                    <div className="mt-3 flex min-h-[44px] flex-wrap content-start gap-1.5">
                      {item.highlights.map(({ icon: Hi, label }) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-black/35 px-2 py-1 text-[10px] font-medium leading-tight text-white/82 backdrop-blur-sm sm:text-[11px]"
                        >
                          <Hi className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" style={{ color: CYAN }} aria-hidden />
                          {label}
                        </span>
                      ))}
                    </div>
                    <div
                      className="mt-5 h-px w-full shrink-0 bg-gradient-to-r from-transparent via-white/[0.14] to-transparent"
                      role="separator"
                    />
                    {includedText ? (
                      <>
                        <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42 drop-shadow-sm">
                          Included
                        </p>
                        <div className="mt-2 flex items-start gap-2.5">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]"
                            style={{ color: CYAN }}
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          <span className="text-sm leading-snug text-white/85">
                            <strong className="font-bold text-white">{includedText}</strong>
                          </span>
                        </div>
                      </>
                    ) : null}
                    <p className="mt-5 flex-1 text-sm leading-relaxed text-white/65 sm:text-[0.9375rem]">{item.desc}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="scroll-mt-24 sm:scroll-mt-28 relative overflow-hidden bg-landing-pattern px-4 py-20 sm:px-6 sm:py-24 md:py-28"
      >
        <div className="container relative z-10 mx-auto max-w-4xl">
          <header className="mx-auto mb-10 max-w-3xl text-center sm:mb-12 md:mb-14">
            <h2 className="text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl">
              Curiosity didn&apos;t kill the cat, it gave it answers.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/65 sm:mt-5 sm:text-lg">
              Common questions about MoLedger
            </p>
          </header>
          <Accordion type="single" collapsible className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl border border-white/10 bg-[#0d0d12] px-3 sm:px-4">
                <AccordionTrigger className="py-4 text-left text-sm font-medium leading-snug text-white/90 hover:no-underline sm:py-5 sm:text-base [&>svg]:text-[#00f2ff]">
                  <span className="pr-2">{faq.q}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-relaxed text-white/60 sm:pb-5 sm:text-[0.9375rem]">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#06060a] px-4 py-12 sm:px-6 sm:py-16">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-12">
            <div className="sm:col-span-2 lg:col-span-4">
              <Link
                href="/main"
                className="inline-flex items-center rounded-lg outline-none ring-offset-2 ring-offset-[#06060a] focus-visible:ring-2 focus-visible:ring-[#00f2ff]/40"
                aria-label="MoLedger home"
              >
                <Image
                  src="/logo2.png"
                  alt=""
                  width={180}
                  height={180}
                  className="h-14 w-auto object-contain sm:h-16 sm:w-auto md:h-[4.25rem] md:w-auto"
                />
              </Link>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                Invoicing, stock, payroll, and reports—built for SMEs. Custom websites, POS, and e‑commerce when you need
                more than the core platform.
              </p>
            </div>
            <div className="lg:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Sections</h3>
              <nav className="mt-4 flex flex-col gap-2.5" aria-label="Page sections">
                <a href="#features" className={footerMutedLinkClass}>
                  Features
                </a>
                <a href="#custom-services" className={footerMutedLinkClass}>
                  Services
                </a>
                <a href="#pricing" className={footerMutedLinkClass}>
                  Pricing
                </a>
                <a href="#faq" className={footerMutedLinkClass}>
                  FAQ
                </a>
              </nav>
            </div>
            <div className="lg:col-span-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Legal</h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                <li>
                  <button type="button" onClick={() => setPrivacyOpen(true)} className={`${footerMutedLinkClass} w-full text-left`}>
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setTermsOpen(true)} className={`${footerMutedLinkClass} w-full text-left`}>
                    Terms of Service
                  </button>
                </li>
              </ul>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Contact</h3>
              <ul className="mt-4 flex flex-col gap-3 text-sm">
                <li>
                  <a
                    href={WHATSAPP_CHAT_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-white/70 transition-colors hover:text-[#25D366]"
                  >
                    <WhatsAppGlyph className="h-4 w-4 shrink-0 text-[#25D366]" />
                    <span>+230 5506 3356</span>
                  </a>
                </li>
                <li>
                  <a
                    href={WHATSAPP_SECOND_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-white/70 transition-colors hover:text-[#25D366]"
                  >
                    <WhatsAppGlyph className="h-4 w-4 shrink-0 text-[#25D366]" />
                    <span>+230 5783 3020</span>
                  </a>
                </li>
                <li>
                  <a
                    href={SUPPORT_MAILTO}
                    className="inline-flex items-center gap-2 break-all text-white/70 transition-colors hover:text-[#00f2ff]"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-[#00f2ff]/80" aria-hidden />
                    <span>{SUPPORT_EMAIL}</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-white/[0.07] pt-8 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <a
                href={SUPPORT_MAILTO}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition-colors hover:border-[#00f2ff]/35 hover:text-[#00f2ff]"
                aria-label={`Email ${SUPPORT_EMAIL}`}
              >
                <Mail className="h-4 w-4" />
              </a>
              <a
                href={WHATSAPP_CHAT_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition-colors hover:border-[#25D366]/40 hover:text-[#25D366]"
                aria-label="WhatsApp MoLedger"
              >
                <WhatsAppGlyph className="h-4 w-4" />
              </a>
            </div>
            <p className="text-center text-xs text-white/40 sm:text-right sm:text-sm">
              © {new Date().getFullYear()} MoLedger. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <PrivacyPolicyModal open={privacyOpen} onOpenChange={setPrivacyOpen} />
      <TermsOfServiceModal open={termsOpen} onOpenChange={setTermsOpen} />
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
