import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edgefi Pulse",
  description:
    "Operational intelligence for Edgefi's managed services — customer health, measurement coverage, and Edgefi impact.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
