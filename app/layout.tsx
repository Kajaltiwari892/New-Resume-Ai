import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResumeIQ | AI Resume Analyzer",
  description:
    "AI-powered resume analysis, editing, keyword matching, and interview coaching. Get hired faster.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
