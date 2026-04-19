import type React from "react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-[#06060a] text-white antialiased">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(0, 242, 255, 0.08) 0%, transparent 55%)",
        }}
      />
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        {children}
      </div>
      <p className="relative shrink-0 pb-8 text-center text-xs text-white/40">
        <Link href="/main" className="transition-colors hover:text-white/70">
          MoLedger
        </Link>
        {" · "}
        <span className="text-white/35">Mojhoa Automations</span>
      </p>
    </div>
  );
}
