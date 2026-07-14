import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "edgefi pulse",
  description:
    "operational intelligence for edgefi's managed services — customer health, measurement coverage, and edgefi impact.",
  icons: { icon: "/brand/logomark_purple.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;450;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
