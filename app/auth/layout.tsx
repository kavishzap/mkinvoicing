import type React from "react";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,1.0)_1px,transparent_1px)] bg-[length:16px_16px] opacity-30 pointer-events-none" />
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative">
        <div className="flex justify-center lg:justify-end">
          {children}
        </div>
        <div className="hidden lg:flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/Resume%20folder-bro.png"
              alt=""
              width={500}
              height={400}
              className="object-contain max-h-[400px] w-full"
              priority
            />
            <p className="text-xs text-muted-foreground">
              Developed by Mojhoa Automations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
