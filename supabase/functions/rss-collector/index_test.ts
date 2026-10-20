/**
 * Test nhánh lỗi của `rss-collector`.
 *
 * Chạy: deno test --allow-net --allow-env --allow-read supabase/functions/rss-collector/
 *
 * Cách làm (theo DECISIONS #17): mock `globalThis.fetch` cho domain `fake.test`
 * và URL feed Simon (`testdata/feed.xml`) — KHÔNG gọi mạng tới RSS thật.
 * Mọi call tới Supabase vẫn đi mạng thật. Nhờ vậy test được đúng logic
 * retry/404/410/429/XML hỏng mà không phải cố ép lỗi thật.
 *
 * Fixture Simon là bản XML thật tải ngày 20/10/2026 (entry mới nhất
 * 2026-10-19T23:58:25Z). Checkpoint source thật đang đúng mốc này nên
 * collector không chèn thêm item / không đổi checkpoint — test tất định.
 *
 * ⚠️ Test này GHI THẬT vào DB: tạo 6 row `sources` tên bắt đầu bằng "[TEST] "
 * rồi xoá ở bước cuối (item xoá theo cascade). Cần `SUPABASE_URL` và
 * `SUPABASE_SERVICE_ROLE_KEY` trong env. Không đụng tới các source thật.
 *
 * Test import `./collector.ts` chứ KHÔNG import `./index.ts` — xem DECISIONS #32.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !KEY) {
  throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong env");
}

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const realFetch = globalThis.fetch;

/** Feed Simon thật — mock bằng fixture để test không phụ thuộc mạng/nội dung mới. */
const SIMON_FEED_URL = "https://simonwillison.net/atom/everything/";
const SIMON_FIXTURE = await Deno.readTextFile(
  new URL("./testdata/feed.xml", import.meta.url),
);

const VALID_ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Feed test</title>
  <author><name>Tác giả cấp feed</name></author>
  <entry>
    <title>Bài duy nhất</title>
    <link href="https://fake.test/bai-1" rel="alternate"/>
    <id>urn:test:1</id>
    <published>2026-10-19T01:00:00Z</published>
    <summary type="html">&lt;p&gt;Tóm tắt &amp;amp; thử &lt;code&gt;&amp;lt;b&amp;gt;&lt;/code&gt;&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;</summary>
  </entry>
</feed>`;

function eq(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`mong đợi: ${e}\n        nhận được: ${a}`);
  }
}

async function insertSource(name: string, url: string): Promise<string> {
  const res = await realFetch(`${SUPABASE_URL}/rest/v1/sources`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ type: "rss", name, config: { url }, enabled: true }),
  });
  const rows = await res.json();
  return rows[0].id as string;
}

async function readSource(id: string): Promise<{ config: Record<string, unknown>; enabled: boolean }> {
  const res = await realFetch(
    `${SUPABASE_URL}/rest/v1/sources?id=eq.${id}&select=config,enabled`,
    { headers: HEADERS },
  );
  return (await res.json())[0];
}

interface Row {
  external_id: string;
  title: string;
  content: string | null;
  author: string | null;
  url: string;
  published_at: string;
  engagement: Record<string, unknown>;
}

async function itemsOf(sourceId: string): Promise<Row[]> {
  const res = await realFetch(
    `${SUPABASE_URL}/rest/v1/items?source_id=eq.${sourceId}&select=external_id,title,content,author,url,published_at,engagement`,
    { headers: HEADERS },
  );
  return await res.json();
}

Deno.test("rss-collector: retry, feed chết, cô lập lỗi, lọc theo checkpoint", async (t) => {
  // Số lần gọi fetch theo từng URL giả — chứng minh retry có/không có.
  const calls: Record<string, number> = {};
  const bump = (path: string): number => (calls[path] = (calls[path] ?? 0) + 1);
  let simonCalls = 0;

  const ids: string[] = [];
  let sourceSimon = "";
  let simonLastSeenBefore = "";

  try {
    await t.step("setup: tạo 6 source test giả + ghi lại last_seen của source thật", async () => {
      ids.push(await insertSource("[TEST] dead-404", "https://fake.test/dead"));
      ids.push(await insertSource("[TEST] gone-410", "https://fake.test/gone"));
      ids.push(await insertSource("[TEST] ratelimited-429", "https://fake.test/ratelimited"));
      ids.push(await insertSource("[TEST] flaky-500", "https://fake.test/flaky-500"));
      ids.push(await insertSource("[TEST] bad-xml", "https://fake.test/bad-xml"));
      ids.push(await insertSource("[TEST] network-error", "https://fake.test/network-error"));
      eq(ids.length, 6);

      const res = await realFetch(
        `${SUPABASE_URL}/rest/v1/sources?type=eq.rss&name=eq.Simon%20Willison&select=id,config`,
        { headers: HEADERS },
      );
      const rows = await res.json();
      if (rows.length !== 1) {
        throw new Error(`mong đợi đúng 1 source "Simon Willison", thấy ${rows.length}`);
      }
      sourceSimon = rows[0].id;
      simonLastSeenBefore = rows[0].config?.last_seen ?? "";
    });

    // Cài mock cho domain fake.test + feed Simon (fixture); Supabase vẫn thật.
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url === SIMON_FEED_URL) {
        simonCalls++;
        return Promise.resolve(
          new Response(SIMON_FIXTURE, {
            status: 200,
            headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
          }),
        );
      }

      if (!url.startsWith("https://fake.test/")) return realFetch(input, init);

      const path = url.slice("https://fake.test/".length);
      const n = bump(path);
      const html = (status: number) =>
        new Response(`<html><body>lỗi ${status} giả lập</body></html>`, {
          status,
          headers: { "Content-Type": "text/html" },
        });

      switch (path) {
        case "dead":
          return Promise.resolve(html(404));
        case "gone":
          return Promise.resolve(html(410));
        case "ratelimited":
          return Promise.resolve(html(429));
        case "network-error":
          return Promise.reject(new Error("giả lập: DNS không phân giải được"));
        case "bad-xml":
          return Promise.resolve(
            new Response("<feed><entry><title>hỏng</entry></feed>", {
              status: 200,
              headers: { "Content-Type": "application/xml" },
            }),
          );
        case "flaky-500":
          // 2 lần đầu 500 (lỗi tạm thời) -> lần 3 trả feed thật.
          return Promise.resolve(n <= 2 ? html(500) : new Response(VALID_ATOM, {
            status: 200,
            headers: { "Content-Type": "application/xml" },
          }));
        default:
          return Promise.resolve(html(599));
      }
    }) as typeof fetch;

    await t.step("chạy collector với mock", async () => {
      // Import `./collector.ts` (KHÔNG phải `./index.ts`): collector.ts thuần logic,
      // import không khởi động Deno.serve nên không chiếm cổng 8000.
      // Xem DECISIONS #32 — nếu import index.ts, health-check của editor gọi vào
      // 127.0.0.1:8000 sẽ kích hoạt thêm 1 lượt runCollector song song.
      const { runCollector } = await import("./collector.ts");
      await runCollector();
    });

    globalThis.fetch = realFetch;

    await t.step("retry: đúng số lần gọi cho từng loại lỗi", () => {
      eq(calls["dead"], 1); // 404 vĩnh viễn -> không retry
      eq(calls["gone"], 1); // 410 vĩnh viễn -> không retry
      eq(calls["ratelimited"], 4); // 429 -> 1 + 3 lần thử lại
      eq(calls["flaky-500"], 3); // 500, 500, 200
      eq(calls["network-error"], 4); // mất mạng -> 1 + 3 lần thử lại
      eq(calls["bad-xml"], 1); // HTTP 200 -> không retry (lỗi ở tầng parse)
    });

    await t.step("feed chết/429/XML hỏng: không ghi checkpoint, không tắt enabled, không tạo item", async () => {
      for (const id of [ids[0], ids[1], ids[2], ids[4]]) {
        const s = await readSource(id);
        eq(s.config.last_seen ?? null, null);
        eq(s.enabled, true);
        eq((await itemsOf(id)).length, 0);
      }
    });

    await t.step("feed lỗi tạm thời -> retry thành công -> lấy được tin + content sạch", async () => {
      const items = await itemsOf(ids[3]);
      eq(items.length, 1);

      const item = items[0];
      eq(item.external_id, "urn:test:1");
      eq(item.title, "Bài duy nhất");
      eq(item.author, "Tác giả cấp feed"); // fallback author cấp feed
      eq(item.url, "https://fake.test/bai-1"); // đã chuẩn hoá
      eq(item.engagement, {}); // RSS không có engagement
      eq(item.published_at, "2026-10-19T01:00:00+00:00");
      // Lột thẻ + giải entity 2 tầng + bỏ CẢ nội dung <script>.
      eq(item.content, "Tóm tắt & thử <b>");

      const s = await readSource(ids[3]);
      eq(s.config.last_seen, "2026-10-19T01:00:00.000Z");
      eq(s.config.url, "https://fake.test/flaky-500"); // giữ nguyên field khác
    });

    await t.step("source thật không bị đụng tới (feed Simon trả fixture, không gọi mạng)", async () => {
      eq(simonCalls, 1); // đã lấy đúng feed Simon từ fixture
      const s = await readSource(sourceSimon);
      eq(s.config.last_seen ?? "", simonLastSeenBefore);
      eq(s.enabled, true);
    });
  } finally {
    globalThis.fetch = realFetch;
    for (const id of ids) {
      await realFetch(`${SUPABASE_URL}/rest/v1/sources?id=eq.${id}`, {
        method: "DELETE",
        headers: HEADERS,
      });
    }
  }
});
