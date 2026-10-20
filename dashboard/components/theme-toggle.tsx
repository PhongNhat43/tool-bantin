"use client";

const STORAGE_KEY = "bantin-theme";

/**
 * Theme light mặc định, lựa chọn lưu ở localStorage.
 *
 * Không nháy theme khi tải lại: script inline trong app/layout.tsx set
 * `data-theme` trước khi paint. Nhãn nút đổi bằng CSS theo `[data-theme]`
 * nên component không cần state (tránh lệch hydration).
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Trình duyệt chặn localStorage (chế độ riêng tư) — vẫn đổi theme phiên này.
    }
  }

  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={toggle}
      title="Chuyển Light / Dark"
      aria-label="Chuyển Light / Dark"
    >
      <span className="label-dark">☀️ Light</span>
      <span className="label-light">🌙 Dark</span>
    </button>
  );
}
