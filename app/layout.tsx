import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepArc",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-[#0b0d0c]">
      <body className="antialiased">{children}</body>
    </html>
  );
}
