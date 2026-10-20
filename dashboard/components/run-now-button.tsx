"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchLastRun,
  type RunCycleResult,
  type RunCycleSummary,
} from "@/lib/items";
import { relativeTime } from "@/lib/format";

type Phase = "idle" | "running" | "done" | "error";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summaryText(summary: RunCycleSummary, statusCode: number): string {
  if (summary.ok === false || statusCode >= 400) {
    return `Lỗi kỳ chạy (HTTP ${statusCode})${summary.error ? `: ${summary.error}` : ""}`;
  }

  const ok = summary.sources_ok ?? 0;
  const failed = summary.sources_failed ?? 0;
  const notes = (summary.notified_instant ?? 0) + (summary.notified_digest ?? 0);
  return `Xong: ${ok}/${ok + failed} nguồn · chấm ${summary.scored ?? 0} tin · ${notes} thông báo`;
}

function errorText(message: string): string {
  if (/PGRST202|Could not find the function/i.test(message)) {
    return "Chưa có RPC run_cycle_result — chạy migration 20261021_rpc_grant.sql trong SQL Editor.";
  }
  if (/permission denied|42501/i.test(message)) {
    return "Chưa được cấp quyền gọi trigger_run_cycle — chạy migration 20261021_rpc_grant.sql.";
  }
  return `Không chạy được: ${message}`;
}

export function RunNowButton({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState("");
  const [lastRun, setLastRun] = useState<RunCycleResult | null>(null);

  // Hiện "kỳ cuối" ngay khi mở dashboard (nếu đã có migration grant).
  useEffect(() => {
    let active = true;
    fetchLastRun(createClient())
      .then((result) => {
        if (active && result) setLastRun(result);
      })
      .catch(() => {
        // Chưa cấp quyền / chưa có kỳ nào — không quan trọng, ẩn đi.
      });
    return () => {
      active = false;
    };
  }, []);

  async function runNow() {
    if (phase === "running") return;

    const supabase = createClient();
    setPhase("running");
    setNote("Đang chạy kỳ quét…");

    try {
      // Mốc trước khi trigger — để biết response nào là của lần bấm này.
      const before = await fetchLastRun(supabase);
      const beforeId = before?.id ?? 0;

      const { error } = await supabase.rpc("trigger_run_cycle");
      if (error) throw new Error(error.message);

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      let result: RunCycleResult | null = null;

      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        const latest = await fetchLastRun(supabase);
        if (latest && latest.id > beforeId) {
          result = latest;
          break;
        }
      }

      if (!result) {
        setPhase("error");
        setNote(
          "Đã gửi lệnh chạy nhưng chưa thấy kết quả sau 2 phút — tải lại trang sau ít phút để xem.",
        );
        return;
      }

      setLastRun(result);
      const ok = result.status_code === 200 && result.body?.ok !== false;
      setPhase(ok ? "done" : "error");
      setNote(
        result.body
          ? summaryText(result.body, result.status_code)
          : `run-cycle trả HTTP ${result.status_code} (không có JSON tóm tắt)`,
      );
      onDone();
    } catch (error) {
      setPhase("error");
      setNote(errorText(error instanceof Error ? error.message : String(error)));
    }
  }

  const running = phase === "running";

  return (
    <div className="run-box">
      <button
        type="button"
        className="icon-btn"
        onClick={runNow}
        disabled={running}
        aria-busy={running}
        title="Chạy run-cycle ngay, khỏi chờ kỳ 2 giờ"
      >
        {running ? "⏳ Đang chạy…" : "▶ Chạy ngay"}
      </button>
      {note ? (
        <p
          className={`run-status ${phase === "error" ? "run-status-error" : ""}`}
          role={phase === "error" ? "alert" : "status"}
          title={note}
        >
          {note}
        </p>
      ) : lastRun ? (
        <p className="run-status">kỳ cuối: {relativeTime(lastRun.created)}</p>
      ) : null}
    </div>
  );
}
