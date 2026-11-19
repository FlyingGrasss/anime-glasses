import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Anime Gözlük — Kameranı anime karakterine çevir",
  description:
    "Web kameranı aç, yüzünde anime gözleri, yanak allığı, kedi kulakları ve konuşma balonu oluştur. Her şey tarayıcında çalışır; görüntü hiçbir yere gönderilmez.",
  applicationName: "Anime Gözlük",
  keywords: [
    "anime",
    "webcam",
    "MediaPipe",
    "yüz algılama",
    "tarayıcı demosu",
    "Next.js",
  ],
  openGraph: {
    title: "Anime Gözlük",
    description:
      "Web kameranı anime sahnesine çeviren, tamamen tarayıcıda çalışan küçük bir demo.",
    locale: "tr_TR",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="min-h-dvh bg-white text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
