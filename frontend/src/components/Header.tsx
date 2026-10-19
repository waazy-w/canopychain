"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";

const NAV = [
  { href: "/register", label: "Register project" },
  { href: "/registry", label: "Registry" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-ink">
          <LogoMark />
          CanopyChain
        </Link>
        <nav className="order-last flex w-full items-center gap-1 text-sm sm:order-none sm:w-auto">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 transition ${
                  active ? "bg-raised font-medium text-ink ring-1 ring-line" : "text-muted hover:bg-raised/60 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}

const pillClass =
  "inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-line-strong hover:bg-raised";

/** RainbowKit's connect flow behind our own buttons: a glowing CTA when disconnected, quiet pills once connected. */
function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        if (!mounted) return <div aria-hidden className="h-9 w-36" />;
        if (!account || !chain) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="glow-accent inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-emerald-300"
            >
              Connect Wallet
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="inline-flex items-center rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              Wrong network
            </button>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <button type="button" onClick={openChainModal} className={pillClass} title={chain.name}>
              <span className="pulse-dot h-2 w-2 rounded-full bg-accent" />
              <span className="hidden md:inline">{chain.name}</span>
            </button>
            <button type="button" onClick={openAccountModal} className={`${pillClass} font-mono`}>
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
