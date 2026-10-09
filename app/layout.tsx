import type { Metadata, Viewport } from "next";
import Link from "next/link";
import LangToggle from "@/components/LangToggle";
import T from "@/components/T";
import { LANG_BOOT } from "@/lib/langboot";
import { ui } from "@/lib/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Agent Build Tutor · 智能体搭建教程", template: "%s · Agent Build Tutor" },
  description:
    "A step-by-step, bilingual playbook for building enterprise agent systems, with runnable labs for every module. 分步、双语的企业级智能体系统搭建手册，每个模块都配有可运行的 lab。",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOT }} />
      </head>
      <body>
        <header className="site-head">
          <div className="wrap">
            <Link href="/" className="brand">
              <T v={ui.brandA} /> <span><T v={ui.brandB} /></span>
            </Link>
            <nav className="nav" aria-label="Main">
              <Link href="/"><T v={ui.navMap} /></Link>
              <Link href="/playbook"><T v={ui.navPlaybook} /></Link>
              <Link href="/platforms"><T v={ui.navPlatforms} /></Link>
              <Link href="/databricks/build"><T v={ui.navDbx} /></Link>
              <Link href="/live"><T v={ui.navLive} /></Link>
              <Link href="/tutor"><T v={ui.navTutor} /></Link>
            </nav>
            <LangToggle />
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-foot">
          <div className="wrap"><T v={ui.footer} /></div>
        </footer>
      </body>
    </html>
  );
}
