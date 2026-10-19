/**
 * Bộ từ khóa lọc tin — theo AGENTS.md mục 6 (chốt 19/10/2026).
 * KHÔNG tự ý sửa nội dung các nhóm khi chưa hỏi.
 */

import type { KeywordGroups } from "./types.ts";

/** Trọng số từng nhóm (AGENTS.md mục 6 — T1). */
export const GROUP_SCORES = {
  A: 40,
  B: 30,
  C: 20,
  D: 10,
} as const;

/** Điểm trừ khi dính từ khóa phủ định (bán hàng). */
export const NEGATIVE_PENALTY = 30;

/**
 * Cụm chứa từ khóa phủ định nhưng KHÔNG mang nghĩa bán hàng.
 * Được "khoét" khỏi text trước khi so khớp negative để không phạt oan:
 * - "không bán"  : phủ định của "bán" -> nghĩa ngược lại
 * - "đánh giá"   : review, chữ "giá" nằm trong "đánh giá"
 */
export const NEGATIVE_EXCEPTIONS = ["không bán", "đánh giá"];

export const KEYWORDS: KeywordGroups = {
  groupA: [
    "token free",
    "api miễn phí",
    "free api",
    "key free",
    "giveaway",
    "tặng key",
    "voucher",
    "credits",
    "miễn phí",
  ],
  groupB: [
    "workflow",
    "quy trình",
    "hướng dẫn",
    "tutorial",
    "chia sẻ",
    "prompt",
    "công thức",
    "tips",
    "trick",
    "setup",
    "cấu hình",
    "kinh nghiệm",
  ],
  groupC: [
    "tool mới",
    "ra mắt",
    "release",
    "open source",
    "github",
    "repo",
  ],
  groupD: ["model mới", "phiên bản mới", "update lớn"],
  negative: [
    "ib",
    "inbox",
    "giá",
    "bán",
    "slot",
    "buff",
    "mua chung",
    "thanh lý",
  ],
};

/** Kết quả `matchKeywords`. `group` = "A" | "B" | "C" | "D" | "none". */
export interface KeywordMatch {
  group: string;
  score: number;
}

/**
 * Bỏ dấu tiếng Việt để so khớp không phân biệt dấu.
 * "Miễn phí" -> "mien phi", "Đ" -> "d".
 */
function stripDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Từ khóa ngắn sau khi bỏ dấu dễ khớp nhầm ("giá" -> "gia" khớp "gia đình"),
 * nên chỉ so khớp không dấu với từ khóa đủ dài.
 */
const MIN_LENGTH_FOR_ACCENT_INSENSITIVE = 4;

interface CompiledKeyword {
  /** So khớp giữ nguyên dấu, không phân biệt hoa thường. */
  sensitive: RegExp;
  /** So khớp đã bỏ dấu; null nếu từ khóa vốn không có dấu hoặc quá ngắn. */
  insensitive: RegExp | null;
}

/**
 * Tách theo khoảng trắng để "api miễn phí" khớp được cả "api  miễn   phí".
 * Dùng lookaround thay \b vì \b không hiểu ký tự Unicode tiếng Việt.
 */
function buildPattern(keyword: string, stripped: boolean): string {
  const source = stripped ? stripDiacritics(keyword) : keyword;
  const parts = source.split(/\s+/).filter(Boolean).map(escapeRegex);
  return `(?<![\\p{L}\\p{N}])${parts.join("\\s+")}(?![\\p{L}\\p{N}])`;
}

function compile(keyword: string): CompiledKeyword {
  const normalized = keyword.trim().toLowerCase();
  const stripped = stripDiacritics(normalized);
  const hasDiacritics = stripped !== normalized;

  const insensitive =
    hasDiacritics && stripped.length >= MIN_LENGTH_FOR_ACCENT_INSENSITIVE
      ? new RegExp(buildPattern(normalized, true), "u")
      : null;

  return {
    sensitive: new RegExp(buildPattern(normalized, false), "u"),
    insensitive,
  };
}

/** Biên dịch 1 lần lúc load module, không compile lại mỗi lần gọi. */
function compileAll(words: string[]): CompiledKeyword[] {
  return words.map(compile);
}

const COMPILED = {
  A: compileAll(KEYWORDS.groupA),
  B: compileAll(KEYWORDS.groupB),
  C: compileAll(KEYWORDS.groupC),
  D: compileAll(KEYWORDS.groupD),
  negative: compileAll(KEYWORDS.negative),
};

/**
 * Mẫu global để "khoét" cụm exception khỏi text trước khi so khớp negative.
 * Giữ 2 bản: có dấu (khớp trên raw) và không dấu (khớp trên text đã strip),
 * khớp với cách `matchesAny` đang kiểm tra negative.
 */
function compileExceptionMask(phrase: string, stripped: boolean): RegExp {
  return new RegExp(
    buildPattern(phrase.trim().toLowerCase(), stripped),
    "gu",
  );
}

const EXCEPTION_MASKS = NEGATIVE_EXCEPTIONS.flatMap((phrase) => [
  compileExceptionMask(phrase, false),
  compileExceptionMask(phrase, true),
]);

/**
 * Thay mọi cụm exception bằng khoảng trắng (giữ nguyên độ dài để không dính
 * từ hai bên lại với nhau), nhờ vậy `bán` trong "không bán" và `giá` trong
 * "đánh giá" không còn bị tính là từ khóa phủ định.
 */
function maskExceptions(text: string): string {
  let masked = text;
  for (const pattern of EXCEPTION_MASKS) {
    masked = masked.replace(pattern, (match) => " ".repeat(match.length));
  }
  return masked;
}

function matchesAny(
  compiled: CompiledKeyword[],
  rawText: string,
  strippedText: string,
): boolean {
  for (const kw of compiled) {
    if (kw.sensitive.test(rawText)) return true;
    if (kw.insensitive !== null && kw.insensitive.test(strippedText)) return true;
  }
  return false;
}

/**
 * Tìm nhóm từ khóa mạnh nhất trong `text`.
 *
 * - Nhóm ưu tiên theo thứ tự A > B > C > D (AGENTS.md: nhóm A cao nhất).
 * - Điểm = điểm của nhóm mạnh nhất; dính từ khóa phủ định thì trừ 30, tối thiểu 0.
 * - Không khớp nhóm nào -> `{ group: "none", score: 0 }`.
 */
export function matchKeywords(text: string): KeywordMatch {
  const raw = (text ?? "").toLowerCase();
  const stripped = stripDiacritics(raw);

  const group: "A" | "B" | "C" | "D" | null =
    matchesAny(COMPILED.A, raw, stripped)
      ? "A"
      : matchesAny(COMPILED.B, raw, stripped)
        ? "B"
        : matchesAny(COMPILED.C, raw, stripped)
          ? "C"
          : matchesAny(COMPILED.D, raw, stripped)
            ? "D"
            : null;

  if (group === null) {
    return { group: "none", score: 0 };
  }

  const base: number = GROUP_SCORES[group];

  // Khoét cụm exception trước khi so khớp negative để không phạt oan.
  const negativeRaw = maskExceptions(raw);
  const negativeStripped = stripDiacritics(negativeRaw);

  const penalized = matchesAny(COMPILED.negative, negativeRaw, negativeStripped)
    ? base - NEGATIVE_PENALTY
    : base;

  return { group, score: Math.max(0, penalized) };
}
