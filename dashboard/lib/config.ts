/**
 * basePath của site, lấy từ `next.config.ts` (inlined lúc build).
 * GitHub Pages: "/tool-bantin". Test serve ở gốc domain: "".
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
