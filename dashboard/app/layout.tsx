import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bản tin AI",
  description: "Dashboard đọc tin AI từ Supabase",
};

// Chạy trước khi paint: đọc theme đã lưu để không nháy light -> dark khi tải lại.
const themeScript = `(function(){try{var t=localStorage.getItem("bantin-theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
