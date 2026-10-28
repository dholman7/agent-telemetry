import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Instrument_Sans({ variable: "--font-sans", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "Agent Telemetry", template: "%s | Agent Telemetry" },
  description: "Success rates, seeded-bug detection, and traces for coding agents scored by agent-eval-gate.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="masthead">
          <Link href="/" className="wordmark">
            Agent Telemetry
          </Link>
          <nav aria-label="Projects">
            <a href="https://github.com/dholman7/agent-eval-gate">agent-eval-gate</a>
            <a href="https://github.com/dholman7/storywright">Storywright</a>
            <a href="https://github.com/dholman7/agent-telemetry">Source</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
