import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWAProvider from "@/components/common/PWAProvider";

export const viewport: Viewport = {
  themeColor: "#0B0F19",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Digital Syllabus Platform - Modern Mobile-First Course Viewer & AI Builder",
  description: "An interactive digital syllabus platform for software engineering and design students, powered by Next.js 15, Gemini 2.5 Pro, and Sandpack.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Syllabus",
  },
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0B0F19" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Syllabus" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@400;500;600;700;800&display=swap" 
          rel="stylesheet" 
        />
        {/* Auto-recover from stale cached chunks / deployments */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                var msg = (e && e.message) ? e.message : '';
                if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1 || msg.indexOf('Unexpected token') !== -1) {
                  var key = 'chunk_reload_lock';
                  var last = sessionStorage.getItem(key);
                  var now = Date.now();
                  if (!last || now - parseInt(last, 10) > 10000) {
                    sessionStorage.setItem(key, String(now));
                    window.location.reload();
                  }
                }
              });
            `,
          }}
        />
      </head>
      <body className="bg-[#0B0F19] text-[#CBD5E1] antialiased selection:bg-[#06B6D4] selection:text-white">
        <PWAProvider>
          {children}
        </PWAProvider>
      </body>
    </html>
  );
}
