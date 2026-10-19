import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StatusBanners } from "@/components/StatusBanners";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CanopyChain",
  description: "Forest carbon credits verified by satellite and issued on-chain (prototype).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>
          <Header />
          <StatusBanners />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
