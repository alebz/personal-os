import type { Metadata } from "next";
import * as React from "react";
import "./globals.css";
import { StarsBackground } from "@/components/StarsBackground";
import { OSSettingsProvider } from "@/components/OSSettingsContext";
import AdanCompanionWrapper from "@/components/AdanCompanionWrapper";

// React 19.1's ViewTransition is runtime-only (not yet in @types/react), and stripped from some
// builds — so use it when present, else fall back to a no-op wrapper. Keeps the prod build/typecheck
// green and never renders `undefined`.
const ViewTransition: React.ComponentType<{ children?: React.ReactNode }> =
  (React as unknown as { unstable_ViewTransition?: React.ComponentType<{ children?: React.ReactNode }> }).unstable_ViewTransition
  ?? (React.Fragment as unknown as React.ComponentType<{ children?: React.ReactNode }>);

export const metadata: Metadata = {
  title: "personal-os",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Press+Start+2P&family=Silkscreen:wght@400;700&family=VT323&display=swap" />
        {/* Apply saved font before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('os-settings');if(s){var f={system:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",mono:"'JetBrains Mono','Fira Code','Courier New',monospace"};var font=f[JSON.parse(s).font]||f.system;document.documentElement.style.setProperty('--os-font',font);}}catch(e){}})();` }} />
      </head>
      <body className="bg-ink-0 text-ink-4 antialiased">
        <OSSettingsProvider>
          <StarsBackground />
          <AdanCompanionWrapper />
          {/* Content sits above the cosmic sim (which is fixed at z:0); this baseline
              keeps every card, sub-menu and button in front of the ships. */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <ViewTransition>{children}</ViewTransition>
          </div>
        </OSSettingsProvider>
      </body>
    </html>
  );
}
