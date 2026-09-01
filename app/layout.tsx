import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://reparc.netlify.app"),
  title: { default: "RepArc", template: "%s · RepArc" },
  description: "Log workouts, follow progressive overload targets, and see your strength build over time.",
  applicationName: "RepArc",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RepArc",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "RepArc",
    title: "RepArc",
    description: "Evidence-aligned training, focused logging, and offline-first progress tracking.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "RepArc — Train. Record. Progress." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RepArc",
    description: "Evidence-aligned training, focused logging, and offline-first progress tracking.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
