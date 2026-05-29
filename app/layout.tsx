import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "IPA Fantasy Football",
    template: "%s · IPA",
  },
  description: "IPA Fantasy Football - Premier League con regole Mantra",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IPA",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${geist.variable} h-full overflow-x-hidden`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Inline script: apply saved theme before first paint (avoids flash) */}
        <script dangerouslySetInnerHTML={{ __html: `
try{var t=localStorage.getItem('ipa-theme');if(t==='dark')document.documentElement.classList.add('dark');else if(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('dark');}catch(e){}
        `.trim() }} />
        {/* Register PWA service worker */}
        <script dangerouslySetInnerHTML={{ __html: `
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}
        `.trim() }} />
      </head>
      <body className="min-h-full text-gray-900 antialiased overflow-x-hidden">{children}</body>
    </html>
  );
}
