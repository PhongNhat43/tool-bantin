# Nguồn dự kiến cho tool bản tin AI (draft 19/10/2026)

## Facebook Groups (đã verify: Phong đã tham gia, quét được qua facebook-cli)
| Group | ID | Members | Ghi chú |
|---|---|---|---|
| Vibe Code kiếm cơm | 1385451906420187 | 143k | core, đã quét thử OK |
| Antigravity VN 🇻🇳 | 1522144709086429 | 103k | Phong đề xuất thêm 19/10 — về IDE Antigravity của Google, đúng tệp workflow/quota token |
| Cộng đồng Claude AI & AI Agents Việt Nam | 861108920047086 | 382k | rất hợp — focus Claude/Agents |
| Nghiện AI - Học Và Làm AI | 143711039115610 | 380k | cộng đồng lớn, đa chủ đề AI |
| Cơm AI lo | 591054007361950 | 206k | tên na ná Vibe Code, có thể cùng tệp |
| OpenClaw - AI Agents VN | 852586990732832 | 168k | focus AI agents |
| Xóa "Mù" Lập Trình \| AI Agent | 1822640597820329 | 88k | nhỏ hơn, có thể chất hơn |

Cách lấy: Merlin quét bằng lịch tự động → POST vào API backend. Không cần code collector.

## Reddit (đã verify tồn tại & active qua web search)
| Subreddit | Hợp với nhu cầu |
|---|---|
| r/ClaudeAI | cao nhất — Claude Code workflows, agent setups, cost management |
| r/ChatGPTCoding | AI coding đa tool |
| r/AI_Agents | build logs, kiến trúc agent |
| r/LocalLLaMA | optional — local models |
| r/cursor | optional — Cursor workflows |

Cách lấy (verify lại 19/10/2026 — JSON không-auth đã chết): từ cuối 5/2026 Reddit trả 403 cho mọi request `.json` không đăng nhập (nhiều nguồn độc lập 2026 xác nhận), và endpoint RSS (`/r/<name>/new/.rss`) cũng bị bot-check JS chặn với client tự động — kiểm chứng trực tiếp bằng browser ngày 19/10/2026. Hai đường còn lại: (1) OAuth Data API chính thức — free cho dùng cá nhân (~100 req/phút), cần Phong tạo Reddit app lấy client ID + secret (lưu vào Supabase secrets, không paste lên chat; một nguồn báo có thể cần duyệt manual vài tuần — chưa xác minh); (2) hoãn Reddit sang v2, vì HN + GitHub + RSS blogs + FB groups đã phủ tốt mảng AI coding. Không dùng `/r/<name>/new.json` kiểu cũ — sẽ 403.

## YouTube (chờ Phong chọn 3–5 kênh hay xem)
Cách lấy: YouTube Data API v3 (official, free quota 10k units/ngày — đủ cho vài kênh, quét 2h/lần).
Gợi ý tiêu chí chọn kênh: kênh chuyên AI coding tools/workflows, ra video đều, không phải kênh reup.

## RSS blogs (đề xuất — verify RSS endpoint khi implement)
- Anthropic news/blog, OpenAI blog, Google DeepMind blog
- Simon Willison's blog (dev viết về LLM, rất hợp)
Cách lấy: RSS auto-discovery → parse XML. Rẻ và bền nhất trong các loại nguồn.

## Hacker News
Cách lấy: Algolia HN Search API (`hn.algolia.com/api/v1/search?query=...&tags=story`) — official, free, không cần key.
Query gợi ý: "Claude Code", "AI coding", "AI agents".

## GitHub
Chờ Phong chốt 3 trục (chủ đề / tín hiệu nổi / chất lượng) — đang bàn.

## TikTok
v1 bỏ qua như đã chốt. Bắt nội dung TikTok qua nguồn share lại (Facebook groups, YouTube).

## Tiêu chí lọc 3 tầng (draft 19/10 — đang bàn với Phong)

### Tầng 1 — Khớp chủ đề (từ khóa, trọng số khác nhau)
- Nhóm A "token/API miễn phí" (ưu tiên cao nhất): token free, api miễn phí, free api, key free, giveaway, tặng key, voucher, credits free, miễn phí
- Nhóm B "workflow & bí quyết": workflow, quy trình, hướng dẫn, tutorial, chia sẻ, prompt, công thức, tips, trick, setup, cấu hình, kinh nghiệm
- Nhóm C "tool/sản phẩm mới": tool mới, ra mắt, release, open source, github, repo
- Nhóm D "tin tức": model mới, phiên bản mới, update lớn
- Từ khóa phủ định (bài bán hàng): ib, inbox, giá, bán, slot, buff, mua chung, thanh lý → trừ điểm nặng, chỉ qua được nếu tương tác vượt ngưỡng cao

### Tầng 2 — Tín hiệu chất lượng (ngưỡng theo nguồn)
- Facebook: reacts + comments ≥ 15 qua vòng loại; ≥ 80 là hot. Bài có link github/drive/repo được cộng điểm.
- Reddit: upvotes ≥ 30, upvote ratio ≥ 0.75
- GitHub: stars > 50, tạo trong 14 ngày, có README, commit trong 30 ngày
- Hacker News: points ≥ 30 qua, ≥ 100 hot
- RSS: theo allowlist nguồn tin cậy, không cần engagement

### Tầng 3 — Phân loại độ khẩn
- BÁO NGAY Telegram: (a) từ khóa nhóm A + bài mới < 24h; (b) cùng nội dung xuất hiện ở ≥ 2 nguồn độc lập trong 24h; (c) từ khóa breaking + engagement cao
- DIGEST theo kỳ: còn lại
- Chỉ lưu DB: điểm thấp, không hiển thị mặc định

### Công thức điểm (đề xuất)
score = chủ đề (0–40) + tương tác chuẩn hóa (0–30) + độ mới (0–20) + cross-source bonus (0–10)
- ≥ 70: báo ngay | 40–69: digest | < 40: chỉ lưu DB

### Chống trùng
Cùng URL (chuẩn hóa, bỏ tracking params) hoặc cùng external_id → gộp thành 1 tin, cộng điểm cross-source.
