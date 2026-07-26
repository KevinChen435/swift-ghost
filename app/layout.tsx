import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.GITHUB_ACTIONS === "true"
    ? "https://kevinchen435.github.io/swift-ghost/"
    : "https://swift-ghost-kevin.kevinchen435.chatgpt.site/";
const socialImageUrl = new URL("og.png", siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Swift Ghost — Type it. Fade it. Own it.",
  description:
    "Rebuild Swift and iOS fluency with 50 interview solutions, 16 practical fundamentals, persistent sessions, honest records, and spaced review.",
  openGraph: {
    title: "Swift Ghost — Swift interview typing practice",
    description: "Type it. Fade it. Own it.",
    images: [{ url: socialImageUrl, width: 1734, height: 907, alt: "Swift Ghost practice preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Swift Ghost",
    description: "Type it. Fade it. Own it.",
    images: [socialImageUrl],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
