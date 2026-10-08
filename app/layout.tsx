import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Agent Build Tutor", template: "%s · Agent Build Tutor" },
  description:
    "A step-by-step playbook for building enterprise agent systems: inference, retrieval, harness, evaluation, memory, MCP, and more, with the reason behind every ordering.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-head">
          <div className="wrap">
            <Link href="/" className="brand">
              Agent Build <span>Tutor</span>
            </Link>
            <nav className="nav" aria-label="Main">
              <Link href="/">Map</Link>
              <Link href="/playbook">Build order</Link>
              <Link href="/platforms">Platforms</Link>
              <Link href="/live">Live build</Link>
              <Link href="/tutor">Ask the tutor</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-foot">
          <div className="wrap">
            Lessons are drawn from a working local build. Hostnames, paths, keys, and domain data are
            removed before publishing. Vendor product names change often, so confirm platform
            details against current vendor documentation.
          </div>
        </footer>
      </body>
    </html>
  );
}
