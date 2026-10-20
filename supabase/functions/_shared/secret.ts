/**
 * So sánh secret kiểu không rò rỉ thời gian — dùng chung cho các endpoint cần
 * auth bằng header (ingest-facebook, run-cycle).
 */

/** So sánh 2 chuỗi theo thời gian hằng số (độ dài khác nhau vẫn quét đủ). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/** So secret người gọi với secret cấu hình. Thiếu 1 trong 2 phía -> false. */
export function checkSecret(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!expected || !provided) return false;
  return timingSafeEqual(provided, expected);
}
