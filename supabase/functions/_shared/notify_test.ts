/**
 * Test cho `_shared/notify.ts` — Task 2.2.
 *
 * Chạy: deno test --allow-env supabase/functions/_shared/notify_test.ts
 *
 * Offline hoàn toàn: Supabase client và Telegram đều là mock. Không cần
 * TELEGRAM_BOT_TOKEN thật, không ghi DB thật.
 */

import {
  buildDigestText,
  sendDigest,
  sendInstant,
  type NotifyDb,
  type NotifyDbResult,
  type NotifyItem,
  type NotifyQuery,
  type NotifyTable,
} from "./notify.ts";

const TOKEN = "123456:TEST-TOKEN";
const CHAT_ID = "-1001234567890";

const ENV_BACKUP = {
  token: Deno.env.get("TELEGRAM_BOT_TOKEN"),
  chat: Deno.env.get("NOTIFY_CHAT_ID"),
};

function setEnv(token = TOKEN, chat = CHAT_ID): void {
  Deno.env.set("TELEGRAM_BOT_TOKEN", token);
  Deno.env.set("NOTIFY_CHAT_ID", chat);
}

function clearEnv(): void {
  Deno.env.delete("TELEGRAM_BOT_TOKEN");
  Deno.env.delete("NOTIFY_CHAT_ID");
}

function restoreEnv(): void {
  if (ENV_BACKUP.token === undefined) Deno.env.delete("TELEGRAM_BOT_TOKEN");
  else Deno.env.set("TELEGRAM_BOT_TOKEN", ENV_BACKUP.token);
  if (ENV_BACKUP.chat === undefined) Deno.env.delete("NOTIFY_CHAT_ID");
  else Deno.env.set("NOTIFY_CHAT_ID", ENV_BACKUP.chat);
}

function eq(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`mong đợi: ${e}\n        nhận được: ${a}`);
  }
}

function ok(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function throws(fn: () => Promise<unknown>, includes: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(includes)) {
      throw new Error(`lỗi throw thiếu "${includes}": ${message}`);
    }
    return;
  }
  throw new Error(`đáng lẽ phải throw (chứa "${includes}") nhưng không throw`);
}

interface LogRow {
  item_id: string;
  channel: string;
}

/** Filter giả lập PostgREST: eq/in + thenable + maybeSingle. */
class FakeFilter implements NotifyQuery<unknown> {
  constructor(
    private readonly rows: readonly LogRow[],
    private readonly conditions: ReadonlyArray<(row: LogRow) => boolean> = [],
  ) {}

  eq(column: string, value: string): NotifyQuery<unknown> {
    return new FakeFilter(this.rows, [
      ...this.conditions,
      (row) => String((row as unknown as Record<string, unknown>)[column]) === value,
    ]);
  }

  in(column: string, values: readonly string[]): NotifyQuery<unknown> {
    const set = new Set(values);
    return new FakeFilter(this.rows, [
      ...this.conditions,
      (row) => set.has(String((row as unknown as Record<string, unknown>)[column])),
    ]);
  }

  private matched(): LogRow[] {
    return this.rows.filter((row) => this.conditions.every((test) => test(row)));
  }

  maybeSingle(): PromiseLike<NotifyDbResult<unknown>> {
    return Promise.resolve({ data: this.matched()[0] ?? null, error: null });
  }

  then<TResult1 = NotifyDbResult<unknown>, TResult2 = never>(
    onfulfilled?:
      | ((value: NotifyDbResult<unknown>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.matched(), error: null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

/** DB giả: `notification_log` trong bộ nhớ, ghi lại các lần insert. */
function fakeDb(initialSent: readonly string[] = []) {
  const rows: LogRow[] = initialSent.map((item_id) => ({
    item_id,
    channel: "telegram",
  }));
  const inserts: string[][] = [];
  let selectCount = 0;

  const db: NotifyDb = {
    from(table: string): NotifyTable {
      if (table !== "notification_log") {
        throw new Error(`test chỉ mock notification_log, nhận: ${table}`);
      }
      return {
        select() {
          selectCount += 1;
          return new FakeFilter(rows);
        },
        insert(values) {
          const list = Array.isArray(values) ? values : [values];
          const ids = list.map((value) => String(value.item_id));
          inserts.push(ids);
          for (const value of list) {
            rows.push({
              item_id: String(value.item_id),
              channel: String(value.channel),
            });
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return {
    db,
    rows,
    inserts,
    get selectCount() {
      return selectCount;
    },
  };
}

interface CapturedCall {
  url: string;
  init?: RequestInit;
  body: Record<string, unknown>;
}

/** Fetch giả: ghi lại request, trả lần lượt các response đã định. */
function fakeFetch(
  responses: ReadonlyArray<{ status?: number; body: unknown }> = [],
) {
  const queue = [...responses];
  const calls: CapturedCall[] = [];

  const fn = (input: string, init?: RequestInit): Promise<Response> => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url: input, init, body });

    const next = queue.shift() ?? { status: 200, body: { ok: true } };
    return Promise.resolve(
      new Response(JSON.stringify(next.body), {
        status: next.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  return { fn, calls };
}

function item(overrides: Partial<NotifyItem> & { id: string }): NotifyItem {
  return {
    title: "Tin thử",
    url: "https://example.com/bai-viet",
    source_name: "Nguồn thử",
    score: 75,
    ...overrides,
  };
}

const telegramBody = (call: CapturedCall): Record<string, unknown> => call.body;

Deno.test("(1) sendInstant: bold title, meta, link, preview bật, log sau khi gửi", async () => {
  setEnv();
  try {
    const { db, inserts } = fakeDb();
    const { fn, calls } = fakeFetch();

    const result = await sendInstant(
      db,
      item({
        id: "item-1",
        title: "Token free cho anh em",
        url: "https://example.com/a?x=1&y=2",
        source_name: "Vibe Code",
        score: 85,
        notify_reason: "nhóm A + bài mới (1.0h)",
      }),
      fn,
    );

    eq(result, "sent");
    eq(calls.length, 1);
    eq(calls[0].url, `https://api.telegram.org/bot${TOKEN}/sendMessage`);

    const body = telegramBody(calls[0]);
    eq(body.chat_id, CHAT_ID);
    eq(body.parse_mode, "HTML");
    eq(body.disable_web_page_preview, false);

    const text = String(body.text);
    ok(text.includes("<b>Token free cho anh em</b>"), `thiếu bold title: ${text}`);
    ok(
      text.includes("Vibe Code · 85 điểm · nhóm A + bài mới (1.0h)"),
      `thiếu dòng meta: ${text}`,
    );
    ok(
      text.includes('<a href="https://example.com/a?x=1&amp;y=2">'),
      `link chưa escape & hoặc thiếu: ${text}`,
    );

    eq(inserts, [["item-1"]]);
  } finally {
    restoreEnv();
  }
});

Deno.test("(2) gửi lại cùng item -> skipped, fetch chỉ gọi 1 lần", async () => {
  setEnv();
  try {
    const fake = fakeDb();
    const { fn, calls } = fakeFetch();
    const tin = item({ id: "item-2" });

    eq(await sendInstant(fake.db, tin, fn), "sent");
    eq(await sendInstant(fake.db, tin, fn), "skipped");

    eq(calls.length, 1);
    eq(fake.inserts, [["item-2"]]);
    eq(fake.rows.length, 1);
  } finally {
    restoreEnv();
  }
});

Deno.test("(3) sendDigest 3 item -> 1 message, 3 bullet, preview tắt", async () => {
  setEnv();
  try {
    const { db, inserts } = fakeDb();
    const { fn, calls } = fakeFetch();
    const items = [
      item({ id: "d-1", title: "Tin Một", source_name: "GitHub", score: 65 }),
      item({ id: "d-2", title: "Tin Hai", source_name: "Reddit", score: 55 }),
      item({ id: "d-3", title: "Tin Ba", source_name: "RSS", score: 45 }),
    ];

    eq(await sendDigest(db, items, fn), "sent");

    eq(calls.length, 1); // đúng 1 tin nhắn cho cả lô
    const body = telegramBody(calls[0]);
    eq(body.disable_web_page_preview, true);

    const text = String(body.text);
    ok(text.startsWith("📰 Bản tin AI — "), `sai header: ${text}`);
    ok(
      /^📰 Bản tin AI — \d{2}\/\d{2}\/\d{4}$/.test(text.split("\n")[0]),
      `header không đúng dạng ngày: ${text.split("\n")[0]}`,
    );

    const bullets = text.split("\n").filter((line) => line.startsWith("•"));
    eq(bullets.length, 3);
    ok(bullets[0].includes("[65] Tin Một — GitHub"), `bullet 1 sai: ${bullets[0]}`);
    ok(bullets[1].includes("[55] Tin Hai — Reddit"), `bullet 2 sai: ${bullets[1]}`);
    ok(bullets[2].includes("[45] Tin Ba — RSS"), `bullet 3 sai: ${bullets[2]}`);
    ok(text.includes("https://example.com/bai-viet"), "thiếu link trong digest");

    eq(inserts, [["d-1", "d-2", "d-3"]]);

    // Gửi lại cả lô -> skipped, không gọi Telegram lần nữa.
    eq(await sendDigest(db, items, fn), "skipped");
    eq(calls.length, 1);
  } finally {
    restoreEnv();
  }
});

Deno.test("(4) tiêu đề chứa HTML -> escape, không vỡ format", async () => {
  setEnv();
  try {
    const { db } = fakeDb();
    const { fn, calls } = fakeFetch();
    const title = `Code <script> & "AI" > tất cả`;

    eq(await sendInstant(db, item({ id: "x-1", title }), fn), "sent");

    const text = String(telegramBody(calls[0]).text);
    ok(text.includes("&lt;script&gt;"), `chưa escape < >: ${text}`);
    ok(text.includes("&amp;"), `chưa escape &: ${text}`);
    ok(!text.includes("<script>"), `vẫn còn thẻ thô: ${text}`);
    ok(text.includes('<b>Code &lt;script&gt; &amp; "AI" &gt; tất cả</b>'), text);

    // Tiêu đề > 150 ký tự bị cắt, vẫn còn dấu …
    const longTitle = "A".repeat(200);
    const { db: db2 } = fakeDb();
    const { fn: fn2, calls: calls2 } = fakeFetch();
    eq(await sendInstant(db2, item({ id: "x-2", title: longTitle }), fn2), "sent");
    const longText = String(telegramBody(calls2[0]).text);
    ok(longText.includes("…"), "tiêu đề dài chưa bị cắt");
    ok(!longText.includes(longTitle), "vẫn còn nguyên tiêu đề 200 ký tự");
  } finally {
    restoreEnv();
  }
});

Deno.test("(5) digest > 4096 ký tự -> cắt bullet cuối + '…và N tin khác', chỉ log tin đã gửi", async () => {
  setEnv();
  try {
    const fake = fakeDb();
    const { fn, calls } = fakeFetch();
    const items = Array.from({ length: 40 }, (_, i) =>
      item({
        id: `long-${i}`,
        title: `Tiêu đề rất dài số ${i} ${"x".repeat(180)}`,
        source_name: "Nguồn có tên khá dài để đẩy độ dài lên",
        score: 50 + (i % 10),
        url: `https://example.com/bai-viet-rat-dai-so-${i}?utm_source=test`,
      }));

    eq(await sendDigest(fake.db, items, fn), "sent");
    eq(calls.length, 1);

    const text = String(telegramBody(calls[0]).text);
    ok(text.length <= 4096, `vượt 4096 ký tự: ${text.length}`);

    const bullets = text.split("\n").filter((line) => line.startsWith("•"));
    ok(bullets.length > 0, "không còn bullet nào");
    ok(bullets.length < items.length, "lẽ ra phải cắt bớt bullet");

    const note = text.split("\n").at(-1)!;
    const match = /^…và (\d+) tin khác$/.exec(note);
    ok(match !== null, `thiếu dòng "…và N tin khác": ${note}`);
    const omitted = Number(match![1]);
    eq(omitted, items.length - bullets.length);

    // Chỉ log đúng số item thực sự có trong tin nhắn.
    eq(fake.inserts.length, 1);
    eq(fake.inserts[0].length, bullets.length);
    eq(fake.rows.length, bullets.length);
    ok(text.includes("long-0") === false, "id không được lọt vào nội dung tin"); // sanity
    ok(fake.inserts[0][0] === "long-0", "phải log từ item đầu tiên");
  } finally {
    restoreEnv();
  }
});

Deno.test("(6) thiếu env -> throw rõ ràng, không gửi, không query DB", async () => {
  clearEnv();
  try {
    const { db, inserts, selectCount } = fakeDb();
    const { fn, calls } = fakeFetch();

    await throws(
      () => sendInstant(db, item({ id: "no-env" }), fn),
      "Thiếu secret Telegram: TELEGRAM_BOT_TOKEN, NOTIFY_CHAT_ID",
    );
    eq(calls.length, 0);
    eq(selectCount, 0);
    eq(inserts.length, 0);

    // Chỉ thiếu 1 biến cũng phải throw và nêu đúng tên biến thiếu.
    Deno.env.set("TELEGRAM_BOT_TOKEN", TOKEN);
    await throws(
      () => sendDigest(db, [item({ id: "no-env-2" })], fn),
      "Thiếu secret Telegram: NOTIFY_CHAT_ID",
    );
    eq(calls.length, 0);
  } finally {
    clearEnv();
    restoreEnv();
  }
});

Deno.test("(7) Telegram lỗi -> throw, KHÔNG ghi log (kỳ sau thử lại)", async () => {
  setEnv();
  try {
    // Telegram trả HTTP 200 nhưng ok:false.
    const { db: db1, inserts: inserts1 } = fakeDb();
    const { fn: fn1 } = fakeFetch([
      { status: 200, body: { ok: false, description: "chat not found" } },
    ]);
    await throws(
      () => sendInstant(db1, item({ id: "fail-1" }), fn1),
      "chat not found",
    );
    eq(inserts1.length, 0);

    // HTTP 500.
    const { db: db2, inserts: inserts2 } = fakeDb();
    const { fn: fn2 } = fakeFetch([{ status: 500, body: { ok: false } }]);
    await throws(
      () => sendInstant(db2, item({ id: "fail-2" }), fn2),
      "HTTP 500",
    );
    eq(inserts2.length, 0);

    // Lỗi mạng.
    const { db: db3, inserts: inserts3 } = fakeDb();
    const networkFn = (): Promise<Response> =>
      Promise.reject(new Error("DNS không phân giải"));
    await throws(
      () => sendInstant(db3, item({ id: "fail-3" }), networkFn),
      "Không gọi được Telegram API",
    );
    eq(inserts3.length, 0);
  } finally {
    restoreEnv();
  }
});

Deno.test("digest: bỏ item đã gửi, không còn gì -> skipped; rỗng -> skipped", async () => {
  setEnv();
  try {
    const { db, inserts } = fakeDb(["old-1", "old-2"]);
    const { fn, calls } = fakeFetch();

    eq(
      await sendDigest(
        db,
        [item({ id: "old-1" }), item({ id: "old-2", title: "Tin cũ 2" })],
        fn,
      ),
      "skipped",
    );
    eq(calls.length, 0);
    eq(inserts.length, 0);

    // Lô trộn: chỉ gửi + log tin chưa gửi.
    eq(
      await sendDigest(
        db,
        [item({ id: "old-1" }), item({ id: "new-1", title: "Tin mới" })],
        fn,
      ),
      "sent",
    );
    eq(calls.length, 1);
    const text = String(telegramBody(calls[0]).text);
    ok(text.includes("Tin mới"), "thiếu tin chưa gửi");
    ok(!text.includes("Tin thử"), "lại gửi tin đã gửi");
    eq(inserts, [["new-1"]]);

    eq(await sendDigest(db, [], fn), "skipped");
    eq(calls.length, 1);
  } finally {
    restoreEnv();
  }
});

Deno.test("buildDigestText: cắt đúng số bullet khi vượt giới hạn", () => {
  const items = Array.from({ length: 30 }, (_, i) =>
    item({
      id: `fit-${i}`,
      title: `Tin ${i} ${"y".repeat(170)}`,
      url: `https://example.com/${i}`,
    }));

  const { text, kept } = buildDigestText(items, new Date("2026-10-19T12:00:00Z"));
  ok(text.length <= 4096, `vượt giới hạn: ${text.length}`);
  ok(kept.length > 0 && kept.length < items.length, "không cắt");
  ok(text.startsWith("📰 Bản tin AI — 19/10/2026"), `sai ngày VN: ${text.slice(0, 40)}`);
  ok(text.endsWith(`…và ${items.length - kept.length} tin khác`), "sai dòng đếm");
  eq(kept.map((i) => i.id), items.slice(0, kept.length).map((i) => i.id));
});
