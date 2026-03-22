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
  Play,
  Mail,
  Twitter,
  Linkedin,
  FileText,
  Users,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LoginModal } from "@/components/login-modal";

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
    <div className="min-h-screen bg-[#06060a] text-white antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#06060a]/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/main" className="flex items-center shrink-0">
            <Image src="/moledger.png" alt="MoLedger" width={56} height={56} className="object-contain" />
          </Link>
          <nav className="flex items-center gap-6 md:gap-10">
            <a href="#faq" className="text-xs font-medium uppercase tracking-widest text-white/80 hover:text-white transition">FAQ</a>
            <a href="#features" className="text-xs font-medium uppercase tracking-widest text-white/80 hover:text-white transition">Features</a>
            <a href="#pricing" className="text-xs font-medium uppercase tracking-widest text-white/80 hover:text-white transition">Pricing</a>
            <Button size="sm" className="rounded-full bg-[#00f2ff]/10 border border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/20 hover:border-[#00f2ff]" asChild>
              <Link href="/auth/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 px-4">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,242,255,0.08),transparent_50%)]" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#ec4899]/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-[#00f2ff]/5 rounded-full blur-3xl -z-10" />
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="flex flex-col justify-center">
              <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: YELLOW }}>Business Management</p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Amazingly simple.
              </h1>
              <p className="text-lg text-white/70 mb-10 max-w-md">
                Invoicing, purchases, payroll, stock, accounting & reports — everything you need to manage your SME in one place.
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-2 w-fit rounded-full px-8 py-3 text-sm font-medium bg-[#0d1624] border-2 transition-all hover:border-[#00f2ff]/80 hover:shadow-[0_0_30px_rgba(0,242,255,0.2)]"
                  style={{ borderColor: "rgba(0,242,255,0.5)" }}
                >
                  <Play className="h-4 w-4 fill-current" style={{ color: CYAN }} />
                  <span style={{ color: CYAN }}>Watch demo</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-medium border border-white/30 text-white hover:bg-white/10 transition"
                >
                  Log in
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl opacity-30 blur-xl" style={{ background: `linear-gradient(135deg, ${CYAN}, ${MAGENTA})` }} />
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-[#0d0d12]">
                <Image
                  src="/ChatGPT Image Mar 23, 2026, 12_17_13 AM.png"
                  alt="MoLedger dashboard"
                  width={600}
                  height={450}
                  className="object-cover w-full h-full"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards - two large cards */}
      <section id="features" className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-white/10 bg-[#0d0d12] p-10 hover:border-[#00f2ff]/30 transition-colors">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: "rgba(0,242,255,0.15)" }}>
                <Zap className="h-7 w-7" style={{ color: CYAN }} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Work smarter, not harder</h3>
              <p className="text-white/70 mb-8">
                Automate invoicing, track expenses, and get real-time reports. One platform for your entire business.
              </p>
              <Button className="rounded-full bg-[#0d1624] border border-[#00f2ff]/50 text-[#00f2ff] hover:bg-[#00f2ff]/10" asChild>
                <Link href="/auth/register">Get started</Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0d0d12] p-10 hover:border-[#00f2ff]/30 transition-colors">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: "rgba(0,242,255,0.15)" }}>
                <Shield className="h-7 w-7" style={{ color: CYAN }} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Sleep easy, we&apos;ve got your back</h3>
              <p className="text-white/70 mb-8">
                Secure, reliable, and built for SMEs. Your data is protected and always available.
              </p>
              <Button variant="outline" className="rounded-full border-white/20 text-white hover:bg-white/5" asChild>
                <Link href="#features">See benefits</Link>
              </Button>
            </div>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-12 text-white/50 text-xs font-medium uppercase tracking-widest">
            <span className="flex items-center gap-2"><Layers className="h-4 w-4" /> Easy integration</span>
            <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Secure</span>
            <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Real-time reports</span>
          </div>

          <div className="mt-24">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Everything you need</h2>
            <p className="text-white/60 text-center mb-12 max-w-2xl mx-auto">
              From invoicing to payroll, from stock to accounting — MoLedger grows with your business.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <section id="pricing" className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Flexible pricing for teams of all sizes</h2>
          <div className="flex items-center justify-center gap-4 mb-16">
            <span className={`text-sm ${!annual ? "text-white" : "text-white/50"}`}>Monthly</span>
            <Switch checked={annual} onCheckedChange={setAnnual} className="data-[state=checked]:bg-[#00f2ff]" />
            <span className={`text-sm ${annual ? "text-white" : "text-white/50"}`}>Annual</span>
            <span className="text-xs text-[#00f2ff]">Save 10%</span>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {pricing.map((plan, i) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 flex flex-col ${
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
      <section id="faq" className="py-24 px-4 bg-[#0a0a0f]">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Curiosity didn&apos;t kill the cat, it gave it answers.</h2>
          <p className="text-white/60 text-center mb-16">Common questions about MoLedger</p>
          <Accordion type="single" collapsible className="grid md:grid-cols-2 gap-6">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-white/10 rounded-xl px-4 bg-[#0d0d12]">
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
      <footer className="py-12 px-4 border-t border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex gap-8 text-sm text-white/60">
              <Link href="#" className="hover:text-white transition">Privacy Policy</Link>
              <Link href="#" className="hover:text-white transition">Terms of Use</Link>
            </div>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition"><Mail className="h-4 w-4" /></a>
              <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition"><Twitter className="h-4 w-4" /></a>
              <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition"><Linkedin className="h-4 w-4" /></a>
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-white/40">© {new Date().getFullYear()} MoLedger. All rights reserved.</p>
        </div>
      </footer>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
