import type React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,1.0)_1px,transparent_1px)] bg-[length:16px_16px] opacity-30 pointer-events-none"></div>
      <div className="w-full max-w-md relative">{children}</div>
    </div>
  );
}
