"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
