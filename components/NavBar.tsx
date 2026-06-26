"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/challenges", label: "Assess" },
  { href: "/results", label: "Profile" },
  { href: "/twin", label: "Twin" }
];

export function NavBar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "glass border-b border-parchment-faint" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-7 h-7 flex items-center justify-center border border-amber/30 rounded-sm bg-obsidian overflow-hidden">
              <div className="absolute inset-0 bg-amber opacity-10 pulse-amber" />
              <div className="w-2.5 h-2.5 bg-amber rotate-45 transform group-hover:rotate-90 transition-transform duration-500 glow-amber" />
            </div>
            <span className="font-serif text-lg tracking-wide text-parchment group-hover:text-amber transition-colors">
              Oraculum
            </span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-2">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href} className="relative px-4 py-1.5 group overflow-hidden">
                  <span className={`relative z-10 text-sm font-sans tracking-wide transition-colors ${
                    active ? "text-amber" : "text-parchment-dim group-hover:text-parchment"
                  }`}>
                    {label}
                  </span>
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 glass-amber rounded-sm border border-amber/20"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Auth / CTA */}
          <div className="flex items-center gap-4">
            <Link
              href="/auth"
              className="text-sm font-mono text-parchment-dim hover:text-amber transition-colors uppercase tracking-wider text-xs"
            >
              [ LOGIN ]
            </Link>
            <Link
              href="/challenges"
              className="btn-amber px-5 py-1.5 text-xs uppercase tracking-widest rounded-sm"
            >
              INITIATE
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
