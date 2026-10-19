/**
 * Test cho `_shared/scoring.ts`.
 *
 * Chạy: deno test supabase/functions/_shared/scoring_test.ts
 *
 * Thuần offline — không cần env, không đụng DB/mạng (đúng yêu cầu Task 2.1).
 * Không dùng thư viện assert ngoài (AGENTS.md mục 1) — tự viết `eq`/`ok`.
 */

import {
  MAX_SCORE,
  scoreItem,
  type ScoreInput,
  type ScoreResult,
} from "./scoring.ts";

/** Mốc thời gian cố định cho mọi test — tránh test phụ thuộc đồng hồ máy. */
const NOW = new Date("2026-10-19T12:00:00Z");

/** Giờ ISO lùi `h` giờ so với NOW (h âm = tương lai). */
function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3_600_000).toISOString();
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

/** Input tối thiểu, các test override phần cần kiểm tra. */
function input(overrides: Partial<ScoreInput>): ScoreInput {
  return {
    title: "Tin thường",
    published_at: hoursAgo(1),
    source_type: "github",
    engagement: { stars: 100 },
    ...overrides,
  };
}

Deno.test("(1) nhóm A + engagement cao: điểm cao, notify_now, reason rõ", () => {
  const r = scoreItem(
    input({
      title: "Tặng key API miễn phí cho anh em",
      source_type: "facebook",
      engagement: { reactions: 70, comments: 10 }, // 80 = hot
      published_at: hoursAgo(2),
    }),
    NOW,
  );

  eq(r.passed, true);
  eq(r.breakdown, {
    topic: 40,
    engagement: 30,
    recency: 20,
    cross_source: 0,
  });
  eq(r.score, 90);
  eq(r.notify_now, true);
  ok(
    typeof r.notify_reason === "string" && r.notify_reason.includes("nhóm A"),
    `reason phải nêu nhóm A, nhận được: ${r.notify_reason}`,
  );
  ok(
    r.notify_reason!.includes("hot"),
    `reason phải nêu engagement hot, nhận được: ${r.notify_reason}`,
  );
});

Deno.test("(2) 'bán tool giá rẻ inbox' -> topic 0", () => {
  const r = scoreItem(
    input({ title: "bán tool giá rẻ inbox", engagement: { stars: 100 } }),
    NOW,
  );

  eq(r.passed, true); // GitHub luôn qua cổng T2
  eq(r.breakdown.topic, 0);

  // Dính từ khóa nhóm C (20) nhưng có từ khóa phủ định -> trừ 30, kẹp 0.
  const withGroup = scoreItem(
    input({ title: "tool mới giá rẻ inbox", engagement: { stars: 100 } }),
    NOW,
  );
  eq(withGroup.breakdown.topic, 0);
});

Deno.test("(3) bài Facebook 10 react -> passed=false, score=0, không báo", () => {
  const r = scoreItem(
    input({
      title: "Tặng key API miễn phí", // nhóm A, nhưng không được cứu
      source_type: "facebook",
      engagement: { reactions: 7, comments: 3 }, // 10 < 15
      published_at: hoursAgo(1),
      cross_source: true,
    }),
    NOW,
  );

  eq(r.passed, false);
  eq(r.score, 0);
  eq(r.breakdown, {
    topic: 0,
    engagement: 0,
    recency: 0,
    cross_source: 0,
  });
  eq(r.notify_now, false);
  eq(r.notify_reason, undefined);
});

Deno.test("(4) tin >48h -> recency 0; đúng các mốc 6/12/24/48h", () => {
  const recencyAt = (h: number): number =>
    scoreItem(input({ published_at: hoursAgo(h) }), NOW).breakdown.recency;

  eq(recencyAt(5.9), 20);
  eq(recencyAt(6), 15);
  eq(recencyAt(11.9), 15);
  eq(recencyAt(12), 10);
  eq(recencyAt(23.9), 10);
  eq(recencyAt(24), 5);
  eq(recencyAt(47.9), 5);
  eq(recencyAt(48), 0);
  eq(recencyAt(49), 0);
  eq(recencyAt(-3), 20); // ngày trong tương lai -> coi như 0h
});

Deno.test("(5) tin RSS -> engagement đúng 15, bỏ qua số liệu thô", () => {
  const r = scoreItem(
    input({
      title: "Chia sẻ workflow hay",
      source_type: "rss",
      engagement: { stars: 9_999, points: 9_999 },
    }),
    NOW,
  );

  eq(r.breakdown.engagement, 15);
  eq(r.passed, true);
  eq(r.score, 30 + 15 + 20); // topic B 30 + engagement 15 + recency 1h 20
});

Deno.test("(6) cross_source=true -> cộng đúng 10", () => {
  const base = input({
    title: "Chia sẻ workflow hay",
    source_type: "rss",
    published_at: hoursAgo(10),
  });

  const without = scoreItem(base, NOW);
  const withCross = scoreItem({ ...base, cross_source: true }, NOW);

  eq(without.breakdown.cross_source, 0);
  eq(withCross.breakdown.cross_source, 10);
  eq(withCross.score - without.score, 10);
  eq(withCross.notify_now, true);
  ok(
    withCross.notify_reason!.includes("cross-source"),
    `reason phải nêu cross-source, nhận được: ${withCross.notify_reason}`,
  );
});

Deno.test("(7) hồi quy 1.1b: 'không bán' / 'đánh giá' không bị trừ oan", () => {
  const topicOf = (title: string): number =>
    scoreItem(input({ title }), NOW).breakdown.topic;

  eq(topicOf("Đánh giá tool mới"), 20); // C, "giá" trong "đánh giá" bị khoét
  eq(topicOf("Không bán token free"), 40); // A, "bán" trong "không bán" bị khoét

  // Nhưng phần còn lại của câu vẫn phạt bình thường (DECISIONS #5).
  eq(topicOf("Đánh giá tool mới, giá siêu rẻ"), 0);
  eq(topicOf("Không bán token free, inbox"), 10); // 40 - 30
});

Deno.test("cổng T2: biên đúng từng nguồn", () => {
  const passed = (i: ScoreInput): boolean => scoreItem(i, NOW).passed;

  // Facebook: 15 qua, 14 loại.
  eq(
    passed(input({
      source_type: "facebook",
      engagement: { reactions: 15 },
    })),
    true,
  );
  eq(
    passed(input({
      source_type: "facebook",
      engagement: { reactions: 10, comments: 4 },
    })),
    false,
  );

  // Reddit: cần upvotes >= 30 VÀ ratio >= 0.75.
  eq(
    passed(input({ source_type: "reddit", engagement: { upvotes: 29, ratio: 1 } })),
    false,
  );
  eq(
    passed(input({
      source_type: "reddit",
      engagement: { upvotes: 30, ratio: 0.74 },
    })),
    false,
  );
  eq(
    passed(input({
      source_type: "reddit",
      engagement: { upvotes: 30, ratio: 0.75 },
    })),
    true,
  );
  // Thiếu ratio coi như 0 -> loại (không đạt 0.75).
  eq(passed(input({ source_type: "reddit", engagement: { upvotes: 500 } })), false);

  // HN: 30 qua, 29 loại.
  eq(
    passed(input({ source_type: "hackernews", engagement: { points: 29 } })),
    false,
  );
  eq(
    passed(input({ source_type: "hackernews", engagement: { points: 30 } })),
    true,
  );

  // GitHub/RSS luôn qua, kể cả 0 tương tác.
  eq(passed(input({ source_type: "github", engagement: {} })), true);
  eq(passed(input({ source_type: "rss", engagement: {} })), true);
});

Deno.test("engagement: nội suy tuyến tính, kẹp 5..30", () => {
  const score = (i: ScoreInput): number =>
    scoreItem(i, NOW).breakdown.engagement;

  // FB: 15 -> 5, 47.5 -> 18, 80 -> 30, 200 -> 30.
  eq(score(input({ source_type: "facebook", engagement: { reactions: 15 } })), 5);
  eq(
    score(input({
      source_type: "facebook",
      engagement: { reactions: 40, comments: 7.5 },
    })),
    18,
  );
  eq(score(input({ source_type: "facebook", engagement: { reactions: 80 } })), 30);
  eq(score(input({ source_type: "facebook", engagement: { reactions: 200 } })), 30);

  // Reddit: 30 -> 5, 115 -> 18, 200 -> 30.
  eq(
    score(input({
      source_type: "reddit",
      engagement: { upvotes: 30, ratio: 1 },
    })),
    5,
  );
  eq(
    score(input({
      source_type: "reddit",
      engagement: { upvotes: 115, ratio: 1 },
    })),
    18,
  );
  eq(
    score(input({
      source_type: "reddit",
      engagement: { upvotes: 200, ratio: 1 },
    })),
    30,
  );

  // GitHub: 50 -> 5, 275 -> 18, 500 -> 30; dưới 50 kẹp 5 (collector đã lọc).
  eq(score(input({ source_type: "github", engagement: { stars: 50 } })), 5);
  eq(score(input({ source_type: "github", engagement: { stars: 275 } })), 18);
  eq(score(input({ source_type: "github", engagement: { stars: 500 } })), 30);
  eq(score(input({ source_type: "github", engagement: { stars: 0 } })), 5);

  // HN: 30 -> 5, 65 -> 18, 100 -> 30.
  eq(
    score(input({ source_type: "hackernews", engagement: { points: 30 } })),
    5,
  );
  eq(
    score(input({ source_type: "hackernews", engagement: { points: 65 } })),
    18,
  );
  eq(
    score(input({ source_type: "hackernews", engagement: { points: 100 } })),
    30,
  );
});

Deno.test("notify_now: đủ 3 luật a/b/c, không báo khi bị loại", () => {
  // (a) nhóm A + <24h, engagement thấp -> vẫn báo.
  const recentGroupA = scoreItem(
    input({
      title: "API miễn phí cho mọi người",
      source_type: "rss",
      published_at: hoursAgo(2),
    }),
    NOW,
  );
  eq(recentGroupA.notify_now, true);
  ok(recentGroupA.notify_reason!.includes("bài mới"), "thiếu lý do bài mới");

  // (a) không áp dụng khi >24h và không hot, không cross-source.
  const oldGroupA = scoreItem(
    input({
      title: "API miễn phí cho mọi người",
      source_type: "facebook",
      engagement: { reactions: 20 }, // qua cổng nhưng chưa hot
      published_at: hoursAgo(30),
    }),
    NOW,
  );
  eq(oldGroupA.passed, true);
  eq(oldGroupA.notify_now, false);

  // RSS >24h: nhóm A nhưng không có ngưỡng hot -> không báo.
  const oldGroupARss = scoreItem(
    input({
      title: "API miễn phí cho mọi người",
      source_type: "rss",
      published_at: hoursAgo(30),
    }),
    NOW,
  );
  eq(oldGroupARss.notify_now, false);

  // (b) cross-source bất kể tuổi tin, kể cả tin không khớp từ khóa.
  const crossOld = scoreItem(
    input({
      title: "Tin lạ",
      source_type: "rss",
      published_at: hoursAgo(72),
      cross_source: true,
    }),
    NOW,
  );
  eq(crossOld.score, 25); // 0 + 15 + 0 + 10
  eq(crossOld.notify_now, true);
  ok(crossOld.notify_reason!.includes("cross-source"), "thiếu lý do cross-source");

  // (c) nhóm A + hot, dù đã 30h tuổi.
  const hotOld = scoreItem(
    input({
      title: "Giveaway token free",
      source_type: "facebook",
      engagement: { reactions: 80 },
      published_at: hoursAgo(30),
    }),
    NOW,
  );
  eq(hotOld.notify_now, true);
  ok(hotOld.notify_reason!.includes("hot"), "thiếu lý do hot");
  ok(!hotOld.notify_reason!.includes("bài mới"), "30h không được ghi là bài mới");

  // (c) nhưng không phải nhóm A thì không báo.
  const hotOldNoGroupA = scoreItem(
    input({
      title: "Tool mới ra mắt",
      source_type: "facebook",
      engagement: { reactions: 80 },
      published_at: hoursAgo(30),
    }),
    NOW,
  );
  eq(hotOldNoGroupA.notify_now, false);
});

Deno.test("bất biến: score = tổng breakdown, tối đa 100, JSON-serializable", () => {
  const cases: ScoreInput[] = [
    input({ source_type: "facebook", engagement: { reactions: 80 } }),
    input({
      source_type: "facebook",
      engagement: { reactions: 40, comments: 7 },
      published_at: hoursAgo(9),
      cross_source: true,
    }),
    input({ source_type: "reddit", engagement: { upvotes: 115, ratio: 0.9 } }),
    input({ source_type: "github", engagement: { stars: 275 } }),
    input({ source_type: "hackernews", engagement: { points: 65 } }),
    input({ source_type: "rss", engagement: {}, published_at: hoursAgo(30) }),
  ];

  for (const c of cases) {
    const r: ScoreResult = scoreItem(c, NOW);
    const sum = r.breakdown.topic + r.breakdown.engagement +
      r.breakdown.recency + r.breakdown.cross_source;
    eq(r.score, sum);
    ok(r.score >= 0 && r.score <= MAX_SCORE, `score ngoài 0..100: ${r.score}`);
    eq(JSON.parse(JSON.stringify(r)), r);
  }

  // Điểm tối đa lý thuyết: A 40 + hot 30 + <6h 20 + cross 10.
  const max = scoreItem(
    input({
      title: "Tặng key API miễn phí",
      source_type: "github",
      engagement: { stars: 500 },
      published_at: hoursAgo(1),
      cross_source: true,
    }),
    NOW,
  );
  eq(MAX_SCORE, 100);
  eq(max.score, 100);
  eq(max.notify_now, true);
});
