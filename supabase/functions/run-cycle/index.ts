// run-cycle — ENTRYPOINT (Supabase Edge Function).
//
// Toàn bộ logic ở ./collector.ts. File này chỉ:
//   - `--once`  : chạy 1 kỳ rồi thoát (test local / backfill).
//   - HTTP POST : pg_cron gọi vào, xác thực header `x-cron-secret` với CRON_SECRET.
//
// Chạy local 1 kỳ: deno run --allow-net --allow-env --allow-read index.ts --once

import { createClient } from "npm:@supabase/supabase-js@2";
import { checkSecret } from "../_shared/secret.ts";
import { runCycle } from "./collector.ts";

const LOG = "[run-cycle]";
const SECRET_HEADER = "x-cron-secret";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Đọc env bắt buộc; thiếu -> throw nêu đúng tên biến. */
function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(
      `Thiếu ${name} trong env/Supabase secrets — không chạy được run-cycle`,
    );
  }
  return value;
}

function createSupabase() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

if (Deno.args.includes("--once")) {
  try {
    const summary = await runCycle(createSupabase());
    console.log(LOG, "summary:", JSON.stringify(summary));
  } catch (error) {
    console.error(LOG, "lỗi:", error);
    Deno.exit(1);
  }
} else {
  Deno.serve(async (req) => {
    // GET/HEAD (health-check) chỉ để biết cổng sống — không đụng DB.
    if (req.method === "GET" || req.method === "HEAD") {
      return json({ ok: true, service: "run-cycle" });
    }
    if (req.method !== "POST") {
      return json({ ok: false, error: "chỉ nhận POST" }, 405);
    }

    let expected: string;
    try {
      expected = requireEnv("CRON_SECRET");
    } catch (error) {
      console.error(LOG, "chưa cấu hình CRON_SECRET -> từ chối (fail closed)");
      return json({ ok: false, error: String(error) }, 500);
    }

    if (!checkSecret(req.headers.get(SECRET_HEADER), expected)) {
      console.error(LOG, "x-cron-secret sai hoặc thiếu -> 401");
      return json({ ok: false, error: "secret sai hoặc thiếu" }, 401);
    }

    try {
      const summary = await runCycle(createSupabase());
      return json({ ok: true, ...summary });
    } catch (error) {
      console.error(LOG, "lỗi:", error);
      return json({ ok: false, error: String(error) }, 500);
    }
  });
}
