import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResearchFlash - 研究灵感速记本",
  description: "你的第二海马体：零摩擦捕捉，算法化重现",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
