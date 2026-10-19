/**
 * Kiểu dữ liệu dùng chung cho mọi collector.
 * Collector KHÔNG được tự định nghĩa lại — luôn import từ file này.
 */

/**
 * Khuôn dữ liệu chuẩn trước khi ghi vào bảng `items`.
 * Mọi collector phải đưa dữ liệu thô về đúng shape này qua `normalize()`.
 */
export interface ItemInput {
  /** Khóa nguồn trong bảng `sources` (vd: "github", "reddit"). */
  source_id: string;
  /** ID gốc của item phía nguồn. Dùng cho UNIQUE(source_id, external_id). */
  external_id: string;
  /** Tiêu đề đã trim. */
  title: string;
  /** Nội dung/mô tả đã trim. Rỗng thì bỏ hẳn (undefined). */
  content?: string;
  /** URL đã chuẩn hóa, đã lột tracking params. */
  url: string;
  /** Tác giả / người đăng nếu nguồn có. */
  author?: string;
  /** Thời điểm publish, luôn ở dạng ISO 8601 string. */
  published_at?: string;
  /** Số liệu tương tác thô, vd: { upvotes: 120, comments: 14 }. */
  engagement?: Record<string, number>;
}

/**
 * Bộ từ khóa lọc tin, chia nhóm theo trọng số trong AGENTS.md mục 6.
 */
export interface KeywordGroups {
  /** Nhóm A — token/API miễn phí. Ưu tiên cao nhất (40 điểm). */
  groupA: string[];
  /** Nhóm B — workflow & bí quyết (30 điểm). */
  groupB: string[];
  /** Nhóm C — tool/sản phẩm mới (20 điểm). */
  groupC: string[];
  /** Nhóm D — tin tức (10 điểm). */
  groupD: string[];
  /** Từ khóa phủ định — dấu hiệu bán hàng, trừ điểm nặng. */
  negative: string[];
}
