"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Callback của magic link: /auth/callback/?code=...
 * supabase-js (detectSessionInUrl) có thể đã tự đổi code lúc khởi tạo,
 * nên kiểm tra session trước rồi mới gọi exchangeCodeForSession.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Đang xác thực magic link…");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const errorDescription = params.get("error_description");
      if (errorDescription) {
        if (active) setMessage(`Magic link không hợp lệ: ${errorDescription}`);
        return;
      }

      // detectSessionInUrl có thể đã đổi code xong trước khi effect này chạy.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        if (active) router.replace("/");
        return;
      }

      // Fallback: link không kèm code_challenge (vd link do admin tạo) trả token
      // trong hash. Client đang ở chế độ PKCE nên tự bắt được — đổi tay.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          window.history.replaceState(null, "", window.location.pathname);
          if (active) router.replace("/");
          return;
        }
        console.error("[auth/callback] setSession:", error.message);
      }

      const code = params.get("code");
      if (!code) {
        if (active) {
          setMessage("Thiếu mã xác thực trong URL. Hãy gửi lại magic link.");
        }
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const {
          data: { session: retry },
        } = await supabase.auth.getSession();
        if (retry) {
          if (active) router.replace("/");
          return;
        }
        console.error("[auth/callback] exchangeCodeForSession:", error.message);
        if (active) setMessage(`Không đổi được mã xác thực: ${error.message}`);
        return;
      }

      if (active) router.replace("/");
    }

    run();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="auth">
      <h1>Bản tin AI</h1>
      <p className="muted">{message}</p>
      <p className="muted">
        <Link href="/login">← Về trang đăng nhập</Link>
      </p>
    </main>
  );
}
