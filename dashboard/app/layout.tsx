import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bản tin AI",
  description: "Dashboard đọc tin AI từ Supabase",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
