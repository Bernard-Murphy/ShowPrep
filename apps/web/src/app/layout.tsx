import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AuthWidget } from "@/components/auth-widget";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = {
  title: "Showprep",
  description: "Show prep for podcasters — stay on top of your subscriptions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <div className="sticky top-5 z-50" style={{ width: "max-content", left: "calc(100% - 5rem)" }}>
            <AuthWidget />
          </div>
          <PageTransition>{children}</PageTransition>
        </Providers>
      </body>
    </html>
  );
}
