import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Énergie France — réseau électrique en temps réel",
  description:
    "Production, consommation, échanges et intensité carbone du réseau électrique français, en temps réel (RTE éCO2mix).",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9ecf1" },
    { media: "(prefers-color-scheme: dark)", color: "#07090d" },
  ],
};

// Applique le thème mémorisé avant le premier rendu (pas de flash clair → sombre).
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="light" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
