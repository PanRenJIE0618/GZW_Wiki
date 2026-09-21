import type { Metadata } from "next";
import { Barlow, Rajdhani, Share_Tech_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { NavigationProgress } from "@/components/NavigationProgress";
import "./globals.css";

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const shareTech = Share_Tech_Mono({
  variable: "--font-share-tech",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "GZWWiki",
  description: "战术情报百科 · 分类 / 词条 / 参数档案",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${rajdhani.variable} ${barlow.variable} ${shareTech.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans text-foreground">
        <NavigationProgress />
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-5 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-border px-3 py-4 text-center text-xs text-muted sm:px-5">
          <span className="font-mono tracking-[0.18em] uppercase">
            GZWWiki // Tactical Intel Archive
          </span>
        </footer>
      </body>
    </html>
  );
}
