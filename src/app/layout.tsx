import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "techmari results analyzer - HT & FT Scores, Predictions & Patterns",
  description: "Analyze historical soccer results with halftime and fulltime scores, predictions using Monte Carlo simulation, and pattern analysis from major European leagues.",
  keywords: ["soccer", "football", "results", "halftime", "fulltime", "predictions", "Monte Carlo", "BTTS", "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "statistics"],
  authors: [{ name: "Techmari Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "techmari results analyzer",
    description: "Analyze halftime and fulltime scores, predictions, and patterns from major European leagues",
    url: "https://chat.z.ai",
    siteName: "Techmari",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "techmari results analyzer",
    description: "Analyze halftime and fulltime scores, predictions, and patterns from major European leagues",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
