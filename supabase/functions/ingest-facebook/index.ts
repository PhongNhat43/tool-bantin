// ingest-facebook — ENTRYPOINT (Supabase Edge Function).
//
// Toàn bộ logic ở ./ingest.ts. File này chỉ làm 2 việc:
//   - Chạy HTTP server: nhận POST, xác thực header `x-ingest-secret`, gọi ingest.
//   - Chạy 1 lần khi có cờ `--once <file.json>` (đọc payload từ file, để test local).
//
// Chạy local 1 lần: deno run --allow-net --allow-env --allow-read index.ts --once payload.json

import { checkSecret, ingestFacebook } from "./ingest.ts";

const LOG = "[ingest-facebook]";
const SECRET_HEADER = "x-ingest-secret";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const onceIdx = Deno.args.indexOf("--once");

if (onceIdx !== -1) {
  const file = Deno.args[onceIdx + 1];
  if (!file) {
    console.error(LOG, "thiếu đường dẫn JSON sau --once");
    Deno.exit(2);
  }
  const payload = JSON.parse(await Deno.readTextFile(file));
  const result = await ingestFacebook(payload);
  console.log(LOG, "kết quả:", JSON.stringify(result, null, 2));
} else {
  Deno.serve(async (req) => {
    // GET/HEAD (vd health-check của editor) chỉ để biết cổng sống — không đụng DB.
    if (req.method === "GET" || req.method === "HEAD") {
      return json({ ok: true, service: "ingest-facebook" });
    }
    if (req.method !== "POST") {
      return json({ ok: false, error: "chỉ nhận POST" }, 405);
    }

    const expected = Deno.env.get("INGEST_SECRET");
    if (!expected) {
      console.error(
        LOG,
        "chưa cấu hình INGEST_SECRET -> từ chối (fail closed)",
      );
      return json(
        { ok: false, error: "server chưa cấu hình INGEST_SECRET" },
        500,
      );
    }
    if (!checkSecret(req.headers.get(SECRET_HEADER), expected)) {
      console.error(LOG, "secret sai hoặc thiếu -> 401");
      return json({ ok: false, error: "secret sai hoặc thiếu" }, 401);
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch (err) {
      return json(
        { ok: false, error: `JSON không hợp lệ: ${String(err)}` },
        400,
      );
    }

    try {
      const result = await ingestFacebook(payload);
      return json(result, 200);
    } catch (err) {
      console.error(LOG, "lỗi:", err);
      return json({ ok: false, error: String(err) }, 500);
    }
  });
}
