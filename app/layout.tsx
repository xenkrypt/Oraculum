import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AuthStatus } from "@/components/AuthStatus";

export const metadata: Metadata = {
  title: "Oraculum",
  description: "An autonomous AI talent-finding agent for everyday people."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5">
          <header className="flex items-center justify-between border-b border-ink/10 py-5">
            <Link href="/" className="text-lg font-semibold tracking-normal">
              Oraculum
            </Link>
            <nav className="hidden items-center gap-5 text-sm text-ink/70 md:flex">
              <Link href="/challenges" className="hover:text-ink">
                Challenges
              </Link>
              <Link href="/results" className="hover:text-ink">
                Results
              </Link>
              <Link href="/twin" className="hover:text-ink">
                Shadow Twin
              </Link>
            </nav>
            <AuthStatus />
          </header>
          <main className="flex-1 py-8 md:py-12">{children}</main>
        </div>
      </body>
    </html>
  );
}
