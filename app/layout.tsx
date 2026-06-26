import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Oraculum — AI Cognitive Operating System",
  description: "Discover the shape of your mind through micro-decisions. Your evolving Shadow Twin reveals hidden talents and future paths.",
  keywords: ["AI", "cognitive assessment", "career", "shadow twin", "talent discovery"],
  openGraph: {
    title: "Oraculum",
    description: "Your AI-powered cognitive operating system",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-obsidian text-parchment antialiased scanlines">
        <NavBar />
        <main className="mx-auto max-w-7xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
