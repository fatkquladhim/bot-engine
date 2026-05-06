import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "ALPHA OMEGA | War Room",
  description: "Advanced Quantitative Trading Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white min-h-screen">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
