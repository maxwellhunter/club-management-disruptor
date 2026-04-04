import type { Metadata } from "next";
import "./globals.css";
import { EnvBanner } from "@/components/env-banner";

export const metadata: Metadata = {
  title: "ClubOS - Modern Club Management",
  description:
    "AI-powered country club management platform. Member management, billing, bookings, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <EnvBanner />
        {children}
      </body>
    </html>
  );
}
