// rss-collector — ENTRYPOINT (Supabase Edge Function).
//
// Toàn bộ logic ở ./collector.ts. File này chỉ làm 2 việc: chạy 1 lần khi có cờ
// `--once`, hoặc mở HTTP server cho Supabase gọi vào.
//
// Chạy local 1 lần: deno run --allow-net --allow-env --allow-read index.ts --once

import { runCollector } from "./collector.ts";

const LOG = "[rss-collector]";

if (Deno.args.includes("--once")) {
  await runCollector();
} else {
  Deno.serve(async () => {
    try {
      await runCollector();
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error(LOG, "lỗi:", err);
      return new Response(
        JSON.stringify({ ok: false, error: String(err) }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  });
}
