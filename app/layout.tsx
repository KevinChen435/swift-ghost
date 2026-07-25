import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swift Ghost — Type it. Fade it. Own it.",
  description:
    "Rebuild Swift interview fluency by typing known solutions with progressively fading guidance.",
  openGraph: {
    title: "Swift Ghost",
    description: "Type it. Fade it. Own it.",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "Swift Ghost practice preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Swift Ghost",
    description: "Type it. Fade it. Own it.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
