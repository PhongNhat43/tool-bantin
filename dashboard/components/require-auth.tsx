"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Chặn trang private ở client (static export không có proxy/middleware).
 * Chưa có session -> đẩy về /login. Đang kiểm tra -> chưa render nội dung.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!active) return;
        if (!session) {
          router.replace("/login");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });

    // Logout ở tab khác / token hết hạn -> đá về login.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) return <p className="muted">Đang kiểm tra đăng nhập…</p>;

  return <>{children}</>;
}
