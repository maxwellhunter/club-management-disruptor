import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
