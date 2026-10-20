import type { NextConfig } from "next";

// GitHub Pages phục vụ file tĩnh dưới https://<user>.github.io/<repo>/
// nên build mặc định gắn basePath = tên repo. Đổi bằng biến môi trường khi cần:
//   NEXT_PUBLIC_BASE_PATH="" npm run build   (serve ở gốc domain, test local)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/tool-bantin";

const nextConfig: NextConfig = {
  // Static export: GitHub Pages không chạy server (không proxy/Route Handler/SSR).
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  env: {
    // Client cần biết basePath để dựng redirect URL của magic link.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
