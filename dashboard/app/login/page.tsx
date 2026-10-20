"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  // Đã đăng nhập thì vào thẳng feed.
  useEffect(() => {
    let active = true;
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (active && session) router.replace("/");
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // trailingSlash: true -> callback là thư mục /auth/callback/
        emailRedirectTo: `${window.location.origin}${BASE_PATH}/auth/callback/`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Đã gửi magic link. Kiểm tra hộp thư (cả Spam) rồi bấm link.");
  }

  return (
    <main className="auth">
      <h1>Bản tin AI</h1>
      <p className="muted">Đăng nhập bằng magic link — chỉ email của bạn.</p>

      <form onSubmit={onSubmit} className="auth-form">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === "sending"}
        />
        <button type="submit" disabled={status === "sending" || !email.trim()}>
          {status === "sending" ? "Đang gửi..." : "Gửi magic link"}
        </button>
      </form>

      {message ? (
        <p className={status === "error" ? "error" : "notice"}>{message}</p>
      ) : null}
    </main>
  );
}
