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
  Cloud,
  Cpu,
  Sparkles,
  Users,
  FileSearch,
  Mail,
  Twitter,
  Linkedin,
  FileText,
  Receipt,
  Settings,
  ScrollText,
  ShoppingCart,
  ClipboardList,
  FileInput,
  Truck,
  Coins,
  Wallet,
  BookOpen,
  Package,
  Store,
  CircuitBoard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LoginModal } from "@/components/login-modal";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";

const CYAN = "#00f2ff";
const YELLOW = "#facc15";
const MAGENTA = "#ec4899";

const faqs = [
  { q: "How do I get started with MoLedger?", a: "Sign up for a free trial. No credit card required. You can import your data and start invoicing within minutes." },
  { q: "Can I upgrade or downgrade my plan?", a: "Yes. You can change your plan anytime. Billing is prorated when you upgrade." },
  { q: "Is my data secure?", a: "We use industry-standard encryption and host on secure cloud infrastructure. Your data is backed up and protected." },
  { q: "Do you offer integrations?", a: "We integrate with popular accounting tools and offer an API for custom integrations." },
  { q: "What payment methods do you accept?", a: "We accept major credit cards, debit cards, and bank transfers for subscription payments." },
  { q: "Is there a mobile app?", a: "A mobile app is on our roadmap. Our web app is fully responsive for use on phones and tablets." },
  { q: "Can I customize my invoices and add my company logo?", a: "Yes. In Company Settings you can upload your logo, set bank details, and configure invoice defaults. Invoices support your branding and export to PDF." },
  { q: "Can I convert a quotation to a sales order?", a: "Yes. Once a client accepts your quote, you can convert it to a sales order in one click and manage the order through to delivery." },
  { q: "How does the purchase flow work?", a: "Create purchase orders to suppliers, then record purchase invoices when bills arrive. You can match invoices to orders and track outstanding amounts." },
  { q: "How do I manage suppliers?", a: "Add supplier details (contact, address, bank info) in the Suppliers section. They can be linked to purchase orders and invoices for a full procurement workflow." },
  { q: "How does customer credit work?", a: "When a customer overpays or you issue credit, it’s tracked against their account. You can apply that credit to future invoices when they pay." },
  { q: "Does MoLedger support payroll?", a: "Yes, on the Pro plan. Add employees, generate payslips, and track salary expenses. Payroll integrates with your expense and reporting data." },
  { q: "Can I track inventory and stock levels?", a: "Yes. Products & Categories let you organise items, and Stock Management tracks levels, low-stock alerts, and movements across your business." },
  { q: "What reports are available?", a: "Sales reports, expense reports, Profit & Loss, and more. Reports can be exported to PDF. Advanced reporting is included in Business and Pro plans." },
];

const features = [
  { icon: FileText, title: "Invoices", desc: "Create professional invoices, track payments & export PDFs" },
  { icon: Users, title: "Customers", desc: "Manage your customer database for invoices & quotations" },
  { icon: Receipt, title: "Expenses", desc: "Track every business expense with line-item detail" },
  { icon: BarChart3, title: "Reports", desc: "Sales, expense & Profit & Loss reports with PDF export" },
  { icon: Settings, title: "Company Settings", desc: "Configure company details, logo, bank info & invoice defaults" },
  { icon: ScrollText, title: "Quotations", desc: "Send quotes to clients and convert them to orders" },
  { icon: ShoppingCart, title: "Sales Orders", desc: "Manage orders from quote to delivery" },
  { icon: ClipboardList, title: "Purchase Orders", desc: "Create and track purchase orders to suppliers" },
  { icon: FileInput, title: "Purchase Invoices", desc: "Record supplier bills and match to purchase orders" },
  { icon: Truck, title: "Suppliers", desc: "Centralise supplier info for procurement" },
  { icon: Coins, title: "Customer Credit", desc: "Track overpayments and apply credit to future invoices" },
  { icon: Wallet, title: "Payroll", desc: "Employee management, payslips & salary expense tracking" },
  { icon: BookOpen, title: "Full Accounting", desc: "Basic ledger, customer/supplier ledger & P&L" },
  { icon: Package, title: "Products & Categories", desc: "Organise products by category for invoices & stock" },
  { icon: Layers, title: "Stock Management", desc: "Track inventory levels, low-stock alerts & movements" },
  { icon: Store, title: "Integrated Point of Sale", desc: "Quick sales at counter with barcode & receipt (coming soon)" },
];

export default function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [annual, setAnnual] = useState(true);
  const pricing = [
    { name: "Starter", price: annual ? 750 * 0.9 : 750, badge: null, includes: ["Dashboard", "Invoices", "Customers", "Expenses", "Basic Reports", "Company Settings"], excludes: ["Payroll", "Stock", "Purchase Flow"] },
    { name: "Business", price: annual ? 1000 * 0.9 : 1000, badge: "Most Popular", includes: ["Everything in Starter", "Quotations", "Sales & Purchase Orders", "Suppliers", "Stock Management", "Advanced Reporting"], excludes: ["Payroll", "Full Accounting"] },
    { name: "Pro", price: annual ? 1500 * 0.9 : 1500, badge: "Full System", includes: ["Everything in Business", "Payroll", "Full Accounting", "Priority Support"], excludes: [] },
  ];

  return (
    <div className="min-h-screen bg-[#06060a] text-white antialiased overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-transparent">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/main" className="flex items-center shrink-0">
            <Image src="/moledger.png" alt="MoLedger" width={48} height={48} className="h-10 w-auto sm:h-14 sm:w-14 object-contain" />
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-3 lg:gap-4">
            <a href="#faq" className="rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-widest text-white border border-white/30 hover:bg-white/10 transition">FAQ</a>
            <a href="#features" className="rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-widest text-white border border-white/30 hover:bg-white/10 transition">Features</a>
            <a href="#pricing" className="rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-widest text-white border border-white/30 hover:bg-white/10 transition">Pricing</a>
            <Link href="/auth/register" className="rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-widest bg-[#00f2ff]/10 border border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/20 hover:border-[#00f2ff] hover:shadow-[0_0_20px_rgba(0,242,255,0.3)] transition">Get started</Link>
          </nav>
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <button type="button" className="md:hidden p-2 rounded-lg border border-white/30 text-white hover:bg-white/10" aria-label="Open menu">
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs border-white/10 bg-[#0d0d12] [&>button]:text-white">
              <nav className="flex flex-col gap-2 pt-8">
                <SheetClose asChild>
                  <a href="#faq" className="rounded-lg px-4 py-3 text-sm font-medium text-white border border-white/30 hover:bg-white/10 transition block">FAQ</a>
                </SheetClose>
                <SheetClose asChild>
                  <a href="#features" className="rounded-lg px-4 py-3 text-sm font-medium text-white border border-white/30 hover:bg-white/10 transition block">Features</a>
                </SheetClose>
                <SheetClose asChild>
                  <a href="#pricing" className="rounded-lg px-4 py-3 text-sm font-medium text-white border border-white/30 hover:bg-white/10 transition block">Pricing</a>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/auth/register" className="rounded-lg px-4 py-3 text-sm font-medium bg-[#00f2ff]/10 border border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/20 hover:border-[#00f2ff] transition text-center block">Get started</Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Hero - extends behind header so image shows through transparent header */}
      <section
        className="relative -mt-14 sm:-mt-16 min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center pt-32 sm:pt-36 pb-20 sm:pb-32 px-4 sm:px-6 overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/55 z-[1]" aria-hidden />

        {/* Central content */}
        <div className="relative z-10 text-center max-w-3xl mx-auto w-full">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4 sm:mb-6">
            Everything Your Business Needs.
            <br />
            In One Place.
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-white/80 mb-8 sm:mb-10 max-w-2xl mx-auto px-0">
            From invoicing to accounting, MoLedger gives you full control of your business with simplicity, clarity, and powerful tools.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-10">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg px-6 py-4 sm:px-8 sm:py-6 text-sm sm:text-base font-medium bg-[#00f2ff]/10 border-2 border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/20 hover:border-[#00f2ff] hover:shadow-[0_0_30px_rgba(0,242,255,0.3)] transition"
            >
              Get Started
            </Link>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="w-full sm:w-auto rounded-lg px-6 py-4 sm:px-8 sm:py-6 text-sm sm:text-base font-medium bg-[#00f2ff]/10 border-2 border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/20 hover:border-[#00f2ff] hover:shadow-[0_0_30px_rgba(0,242,255,0.3)] transition"
            >
              Log in
            </button>
          </div>
          {/* Icons below buttons - 3 left, 3 right */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 md:gap-16">
            <div className="flex gap-2 sm:gap-3 md:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center backdrop-blur-md bg-white/5 border border-white/20 shadow-lg shrink-0">
                <Cloud className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center backdrop-blur-md bg-white/5 border border-white/20 shadow-lg shrink-0">
                <Cpu className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center backdrop-blur-md bg-white/5 border border-white/20 shadow-lg shrink-0">
                <CircuitBoard className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 md:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center backdrop-blur-md bg-white/5 border border-white/20 shadow-lg shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center backdrop-blur-md bg-white/5 border border-white/20 shadow-lg shrink-0">
                <FileSearch className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center backdrop-blur-md bg-white/5 border border-white/20 shadow-lg shrink-0">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards - two large cards */}
      <section id="features" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <div className="rounded-2xl border border-white/10 bg-[#0d0d12] p-6 sm:p-8 md:p-10 hover:border-[#00f2ff]/30 transition-colors">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: "rgba(0,242,255,0.15)" }}>
                <Zap className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: CYAN }} />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Work smarter, not harder</h3>
              <p className="text-white/70 mb-6 sm:mb-8 text-sm sm:text-base">
                Automate invoicing, track expenses, and get real-time reports. One platform for your entire business.
              </p>
              <Button className="rounded-full bg-[#0d1624] border-2 border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/10 px-6" asChild>
                <Link href="/auth/register">Get started</Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0d0d12] p-6 sm:p-8 md:p-10 hover:border-[#00f2ff]/30 transition-colors">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: "rgba(0,242,255,0.15)" }}>
                <Shield className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: CYAN }} />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Sleep easy, we&apos;ve got your back</h3>
              <p className="text-white/70 mb-6 sm:mb-8 text-sm sm:text-base">
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
            <div className="rounded-2xl border border-white/10 bg-[#0d0d12] p-6 sm:p-8 md:p-10 hover:border-[#00f2ff]/30 transition-colors sm:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: "rgba(0,242,255,0.15)" }}>
                <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: CYAN }} />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Grow with clarity</h3>
              <p className="text-white/70 mb-6 sm:mb-8 text-sm sm:text-base">
                Sales, expenses, profit and loss — see exactly how your business is performing with powerful reports and insights.
              </p>
              <Button className="rounded-full bg-[#0d1624] border-2 border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/10 px-6" asChild>
                <Link href="/auth/register">Get started</Link>
              </Button>
            </div>
          </div>
          <div className="mt-8 sm:mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-white/50 text-xs font-medium uppercase tracking-widest">
            <span className="flex items-center gap-2"><Layers className="h-4 w-4" /> Easy integration</span>
            <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Secure</span>
            <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Real-time reports</span>
          </div>

          <div id="feature-list" className="mt-16 sm:mt-20 md:mt-24 scroll-mt-24 sm:scroll-mt-28">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-3 sm:mb-4">Everything you need</h2>
            <p className="text-white/60 text-center mb-8 sm:mb-12 max-w-2xl mx-auto text-sm sm:text-base">
              From invoicing to payroll, from stock to accounting — MoLedger grows with your business.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-white/10 bg-[#0d0d12] p-6 hover:border-[#00f2ff]/30 transition-colors"
                >
                  <div
                    className="rounded-xl w-12 h-12 flex items-center justify-center mb-4"
                    style={{ backgroundColor: "rgba(0,242,255,0.15)" }}
                  >
                    <f.icon className="h-6 w-6" style={{ color: CYAN }} />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-white/60">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4">Flexible pricing for teams of all sizes</h2>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-16">
            <span className={`text-sm ${!annual ? "text-white" : "text-white/50"}`}>Monthly</span>
            <Switch checked={annual} onCheckedChange={setAnnual} className="data-[state=checked]:bg-[#00f2ff]" />
            <span className={`text-sm ${annual ? "text-white" : "text-white/50"}`}>Annual</span>
            <span className="text-xs text-[#00f2ff]">Save 10%</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {pricing.map((plan, i) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-6 sm:p-8 flex flex-col ${
                  plan.badge === "Most Popular"
                    ? "border-2 bg-gradient-to-b from-[#00f2ff]/10 to-transparent"
                    : "border border-white/10 bg-[#0d0d12]"
                }`}
                style={plan.badge === "Most Popular" ? { borderColor: CYAN } : {}}
              >
                {plan.badge === "Most Popular" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: YELLOW }}>
                    <Zap className="h-5 w-5 text-black" />
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">Rs {plan.price}</span>
                  <span className="text-white/50 text-sm"> / month</span>
                </div>
                <ul className="space-y-3 flex-1">
                  {plan.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="h-5 w-5 shrink-0 mt-0.5" style={{ color: CYAN }} />
                      <span className="text-sm text-white/90">{item}</span>
                    </li>
                  ))}
                  {plan.excludes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-white/40">
                      <X className="h-5 w-5 shrink-0 mt-0.5 opacity-50" />
                      <span className="text-sm line-through">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-8 w-full rounded-full ${plan.badge === "Most Popular" ? "bg-[#00f2ff] text-black hover:bg-[#00f2ff]/90" : "bg-white/10 text-white hover:bg-white/20 border border-white/20"}`}
                  size="lg"
                  asChild
                >
                  <Link href="/auth/register">Get started</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 bg-[#0a0a0f]">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-3 sm:mb-4">Curiosity didn&apos;t kill the cat, it gave it answers.</h2>
          <p className="text-white/60 text-center mb-10 sm:mb-16 text-sm sm:text-base">Common questions about MoLedger</p>
          <Accordion type="single" collapsible className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-white/10 rounded-xl px-3 sm:px-4 bg-[#0d0d12]">
                <AccordionTrigger className="text-left py-4 hover:no-underline [&>svg]:text-[#00f2ff]">
                  <span className="text-white/90">{faq.q}</span>
                </AccordionTrigger>
                <AccordionContent className="text-white/60 text-sm pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex flex-wrap justify-center sm:justify-start gap-4 sm:gap-8 text-sm text-white/60">
              <Link href="#" className="hover:text-white transition">Privacy Policy</Link>
              <Link href="#" className="hover:text-white transition">Terms of Use</Link>
            </div>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition"><Mail className="h-4 w-4" /></a>
              <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition"><Twitter className="h-4 w-4" /></a>
              <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition"><Linkedin className="h-4 w-4" /></a>
            </div>
          </div>
          <p className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-white/40">© {new Date().getFullYear()} MoLedger. All rights reserved.</p>
        </div>
      </footer>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
