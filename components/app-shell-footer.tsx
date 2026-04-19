import Link from "next/link";

export function AppShellFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="shrink-0 border-t border-border bg-background/95 px-4 py-3 text-center backdrop-blur supports-[backdrop-filter]:bg-background/80"
      role="contentinfo"
    >
      <p className="text-xs text-muted-foreground">
        Powered by{" "}
        <Link
          href="/main"
          className="font-semibold text-foreground/90 underline-offset-2 hover:text-primary hover:underline"
        >
          MoLedger
        </Link>
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/85">
        © {year} MoLedger. All rights reserved.
      </p>
    </footer>
  );
}
