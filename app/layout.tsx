import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.GITHUB_ACTIONS === "true"
    ? "https://kevinchen435.github.io/swift-ghost/"
    : "https://swift-ghost-kevin.kevinchen435.chatgpt.site/";
const socialImageUrl = new URL("og-v7.png", siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Swift Ghost — Python, Swift, and iOS interview practice",
  description:
    "Rebuild Python interview fluency while keeping Swift and iOS sharp through 102 curated exercises, fading ghost code, spaced review, and honest records.",
  openGraph: {
    title: "Swift Ghost — Python, Swift, and iOS recall practice",
    description: "Type it. Fade it. Explain it. Own it.",
    images: [{ url: socialImageUrl, width: 1734, height: 907, alt: "Swift Ghost practice preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Swift Ghost",
    description: "Python, Swift, and iOS interview recall practice.",
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
