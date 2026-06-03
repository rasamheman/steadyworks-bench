import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steadyworks 3D Design Benchmark",
  description:
    "An open benchmark for AI agents on 3D CAD tasks — primitive modifications, 2D-to-3D translation, assembly, and architecture.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          type="module"
          src="https://unpkg.com/@google/model-viewer@4/dist/model-viewer.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="font-sans antialiased">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-mono font-semibold text-lg text-ink no-underline hover:opacity-80">
              steadyworks/bench
            </Link>
            <nav className="text-sm text-neutral-600 flex gap-6">
              <Link href="/" className="hover:text-ink">tasks</Link>
              <a href="https://github.com/rasamheman/steadyworks-bench" className="hover:text-ink" target="_blank" rel="noopener">github</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-neutral-500">
          Steadyworks 3D Design Benchmark · open benchmark for AI CAD agents
        </footer>
      </body>
    </html>
  );
}
