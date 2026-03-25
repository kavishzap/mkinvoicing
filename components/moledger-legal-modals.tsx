"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const sectionClass = "space-y-2 text-sm leading-relaxed text-white/70";
const hClass = "text-sm font-semibold text-white";

export function PrivacyPolicyModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88vh,800px)] max-w-2xl overflow-y-auto border-white/10 bg-[#0d0d12] p-6 text-white sm:p-8 [&>button]:text-white/55 [&>button]:hover:text-white [&>button]:ring-offset-[#0d0d12]">
        <DialogHeader>
          <DialogTitle className="text-left text-xl font-bold tracking-tight text-white">
            Privacy Policy (Mauritius)
          </DialogTitle>
          <p className="text-left text-xs text-white/50">
            Last updated: {new Date().toLocaleDateString("en-MU", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </DialogHeader>
        <div className="space-y-6 pr-1 pt-2">
          <div className={sectionClass}>
            <p className={hClass}>Who we are</p>
            <p>
              MoLedger (“we”, “us”) provides cloud-based invoicing, accounting, and related business tools. This policy
              explains how we collect, use, store, and protect personal information when you use our website and services.
              It is written for users in Mauritius and reflects our obligations under the{" "}
              <strong className="text-white/90">Data Protection Act 2017</strong> of Mauritius (DPA).
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Information we collect</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-white/85">Account data:</strong> name, email address, company name, and
                credentials you provide when you register or contact us.
              </li>
              <li>
                <strong className="text-white/85">Business data you enter:</strong> customer and supplier details,
                invoices, quotations, orders, expenses, payroll-related information, products, stock movements, and
                other content you store in MoLedger to run your business.
              </li>
              <li>
                <strong className="text-white/85">Technical data:</strong> IP address, device/browser type, approximate
                location derived from IP, log data, and cookies or similar technologies needed for security,
                preferences, and service operation.
              </li>
              <li>
                <strong className="text-white/85">Support communications:</strong> messages you send us by email or
                WhatsApp in connection with support or sales.
              </li>
            </ul>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>How we use your information</p>
            <p>We use personal data to provide and improve MoLedger, authenticate users, process subscriptions, send service-related notices, provide customer support, secure our systems, comply with law, and—where you have agreed—to send marketing you can opt out of at any time.</p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Legal bases (DPA)</p>
            <p>
              We process data where necessary to perform our contract with you, to meet legal obligations, where we have
              your consent (e.g. certain marketing), or where we have a legitimate interest that is not overridden by
              your rights (e.g. fraud prevention, analytics, product improvement).
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Sharing and processors</p>
            <p>
              We do not sell your personal data. We may share data with trusted service providers (e.g. hosting, email
              delivery, payment processing) who process it on our instructions and under appropriate safeguards. We may
              disclose information if required by law or to protect rights, safety, and security.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>International transfers</p>
            <p>
              Your data may be processed on servers located outside Mauritius. Where we transfer personal data, we take
              steps consistent with the DPA and applicable guidance from the Data Protection Commissioner of Mauritius.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Retention</p>
            <p>
              We keep data only as long as needed for the purposes above, including legal, tax, and accounting
              requirements. You may request deletion of your account subject to any overriding legal retention duties.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Your rights (Mauritius)</p>
            <p>
              Subject to the DPA, you may have rights to access, correct, erase, restrict processing, object, and—where
              applicable—data portability. You may lodge a complaint with the{" "}
              <strong className="text-white/90">Data Protection Commissioner, Mauritius</strong>. To exercise your rights
              or ask questions, contact us at{" "}
              <a href="mailto:moledgersupport@gmail.com" className="text-[#00f2ff] hover:underline">
                moledgersupport@gmail.com
              </a>
              .
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Security</p>
            <p>
              We use technical and organisational measures appropriate to the nature of the data, including encryption
              in transit where standard for the service, access controls, and monitoring. No method of transmission or
              storage is completely secure; we encourage strong passwords and careful handling of login details.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Children</p>
            <p>MoLedger is intended for businesses and is not directed at children. We do not knowingly collect personal data from minors.</p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Changes</p>
            <p>We may update this policy from time to time. We will post the revised version on this site and adjust the “Last updated” date.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TermsOfServiceModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88vh,800px)] max-w-2xl overflow-y-auto border-white/10 bg-[#0d0d12] p-6 text-white sm:p-8 [&>button]:text-white/55 [&>button]:hover:text-white [&>button]:ring-offset-[#0d0d12]">
        <DialogHeader>
          <DialogTitle className="text-left text-xl font-bold tracking-tight text-white">
            Terms of Service (Mauritius)
          </DialogTitle>
          <p className="text-left text-xs text-white/50">
            Last updated: {new Date().toLocaleDateString("en-MU", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </DialogHeader>
        <div className="space-y-6 pr-1 pt-2">
          <div className={sectionClass}>
            <p className={hClass}>Agreement</p>
            <p>
              These Terms of Service (“Terms”) govern your access to and use of MoLedger’s website, software, and related
              services (collectively, the “Service”). By creating an account or using the Service, you agree to these
              Terms. If you are using the Service on behalf of a company, you represent that you have authority to bind
              that entity.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>The Service</p>
            <p>
              MoLedger provides tools for invoicing, customers, expenses, reporting, company settings, quotations, sales
              and purchase workflows, suppliers, stock, payroll (where included in your plan), accounting views, and
              related features as described on our website. Some features may be labelled beta or coming soon; we may
              change or discontinue features with reasonable notice where practicable.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Accounts and security</p>
            <p>
              You must provide accurate registration information and keep your credentials confidential. You are
              responsible for activity under your account. Notify us promptly at{" "}
              <a href="mailto:moledgersupport@gmail.com" className="text-[#00f2ff] hover:underline">
                moledgersupport@gmail.com
              </a>{" "}
              if you suspect unauthorised access.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Subscriptions, fees, and taxes</p>
            <p>
              Paid plans, billing cycles, and prices are as shown at signup or in your account. Fees may be quoted in
              Mauritian Rupees (MUR) or another currency as we specify. You are responsible for applicable taxes (such as
              VAT in Mauritius, where chargeable) unless stated otherwise. Failure to pay may result in suspension or
              termination of access after notice where appropriate.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Your content</p>
            <p>
              You retain ownership of data you upload or enter. You grant us a licence to host, process, back up, and
              display your content solely to provide and improve the Service and as required by law. You are responsible
              for the legality of your content and for obtaining any consents needed from your customers or employees.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Acceptable use</p>
            <p>
              You may not misuse the Service, including by attempting to breach security, interfere with other users,
              distribute malware, send spam, or use the Service for unlawful purposes. We may suspend or terminate access
              for material breaches.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Custom services</p>
            <p>
              Bespoke websites, POS, e‑commerce, or other professional services may be agreed separately. Unless
              otherwise agreed in writing, these Terms apply only to the standard MoLedger platform subscription.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Disclaimer</p>
            <p>
              The Service is provided on an “as is” and “as available” basis to the fullest extent permitted by law in
              Mauritius. We do not guarantee uninterrupted or error-free operation. You remain responsible for your
              business decisions, tax filings, and compliance with applicable laws (including MRA requirements); MoLedger
              is a tool, not professional tax or legal advice.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Limitation of liability</p>
            <p>
              To the extent permitted by the laws of the Republic of Mauritius, we are not liable for indirect,
              incidental, special, consequential, or punitive damages, or loss of profits, data, or goodwill. Our total
              liability arising out of these Terms or the Service in any twelve-month period is limited to the fees you
              paid to us for the Service in that period, except where liability cannot be excluded or limited under
              Mauritian consumer or other mandatory law.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Indemnity</p>
            <p>
              You will defend and indemnify us against third-party claims arising from your content or your misuse of the
              Service, subject to applicable law.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Termination</p>
            <p>
              You may stop using the Service and request account closure. We may suspend or terminate access for breach
              of these Terms, non-payment, or legal requirements. Provisions that by nature should survive (e.g. liability
              limits, governing law) will survive termination.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Governing law and disputes</p>
            <p>
              These Terms are governed by the laws of the <strong className="text-white/90">Republic of Mauritius</strong>.
              Courts of Mauritius shall have non-exclusive jurisdiction, without prejudice to any mandatory rights you may
              have as a consumer.
            </p>
          </div>
          <div className={sectionClass}>
            <p className={hClass}>Contact</p>
            <p>
              Questions about these Terms:{" "}
              <a href="mailto:moledgersupport@gmail.com" className="text-[#00f2ff] hover:underline">
                moledgersupport@gmail.com
              </a>
              . WhatsApp: +230 5918 2520 or +230 5783 3020.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
