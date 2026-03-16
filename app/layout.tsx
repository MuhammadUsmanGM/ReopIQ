import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas-neue",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeLens | Neural Codebase Explorer",
  description: "Advanced AI-powered repository analysis and conversational indexer for premium engineering teams.",
  icons: {
    icon: "/logo.webp",
  },
  openGraph: {
    title: "CodeLens | Neural Codebase Explorer",
    description: "Advanced AI-powered repository analysis and conversational indexer for premium engineering teams.",
    type: "website",
    images: ["/logo.webp"],
  },
  twitter: {
    card: "summary",
    title: "CodeLens | Neural Codebase Explorer",
    description: "Advanced AI-powered repository analysis and conversational indexer for premium engineering teams.",
  },
  robots: {
    index: true,
    follow: true,
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
        className={`${bebasNeue.variable} ${dmSans.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
