"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/register", label: "Register project" },
  { href: "/registry", label: "Registry" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-forest-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-forest-800">
          <span aria-hidden className="text-xl">🌳</span>
          CanopyChain
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-1.5 hover:bg-forest-50 ${
                pathname.startsWith(item.href) ? "bg-forest-50 font-medium text-forest-800" : "text-stone-600"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
      </div>
    </header>
  );
}
