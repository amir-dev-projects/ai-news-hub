import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI News Hub",
  description: "Discover. Understand. Learn. Stay ahead.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
