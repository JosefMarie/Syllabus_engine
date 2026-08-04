import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Syllabus Platform - Modern Mobile-First Course Viewer & AI Builder",
  description: "An interactive digital syllabus platform for software engineering and design students, powered by Next.js 15, Gemini 2.5 Pro, and Sandpack.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@400;500;600;700;800&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="bg-[#0B0F19] text-[#CBD5E1] antialiased selection:bg-[#06B6D4] selection:text-white">
        {children}
      </body>
    </html>
  );
}
