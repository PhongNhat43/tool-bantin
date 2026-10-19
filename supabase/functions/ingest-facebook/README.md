# ingest-facebook — hợp đồng dữ liệu cho Merlin

Endpoint **nhận** (push) dữ liệu Facebook do Merlin quét về. Không phải collector đi fetch.

## 1. Endpoint

```
POST https://<project>.supabase.co/functions/v1/ingest-facebook
Header:  x-ingest-secret: <INGEST_SECRET>
Header:  Content-Type: application/json
```

Local (khi chạy `deno run ... index.ts`): `POST http://127.0.0.1:8000/`

**Không gửi JWT Supabase.** Function này đã tắt `verify_jwt` (xem `supabase/config.toml`)
vì xác thực bằng `INGEST_SECRET` riêng.

## 2. Body

Nhận 1 trong 3 dạng:

```jsonc
// (a) 1 bài lẻ
{ "group_id": "...", "post_id": "...", "text": "..." }

// (b) mảng nhiều bài
[ { ... }, { ... } ]

// (c) bọc trong posts / items / data
{ "posts": [ { ... }, { ... } ] }
```

Mỗi bài là 1 object. Các field dưới đây **chấp nhận nhiều alias** (tên nào cũng được):

| Ý nghĩa | Tên ưu tiên | Alias chấp nhận | Bắt buộc |
|---|---|---|---|
| Group | `group_id` | `groupId`, `groupID`, `group`, `source_group_id` | ✅ |
| ID bài | `post_id` | `postId`, `external_id`, `object_id`, `id` | ✅ |
| Nội dung | `text` | `content`, `message`, `body`, `description`, `caption` | ✅ |
| Link bài | `url` | `permalink`, `permalink_url`, `link`, `post_url` | ❌ (tự dựng từ group_id + post_id) |
| Tác giả | `author` | `author_name`, `from`, `user`, `poster` | ❌ |
| Thời gian | `created_at` | `created_time`, `published_at`, `timestamp`, `time`, `date` | ❌ |
| Reactions | `reactions` | `reacts`, `reaction_count`, `likes`, `like_count` | ❌ |
| Comments | `comments` | `comment_count`, `comments_count`, `num_comments` | ❌ |
| Shares | `shares` | `share_count`, `shares_count` | ❌ |

Ghi chú:
- `group_id` phải khớp `sources.config.group_id` của group đã seed (hoặc khớp đúng `name` của source). Không khớp → bài đó bị **bỏ qua**, không lỗi cả request.
- Thời gian: nhận ISO 8601 hoặc số (unix **giây** nếu < 1e12, còn lại là **ms**).
- `external_id` để chống trùng: cùng (`source_id`, `post_id`) gửi lại chỉ tốn 1 dòng (`UNIQUE`).
- Bài **thiếu `post_id` hoặc thiếu `text`** bị bỏ qua (có ghi lý do trong response).
- `text` > 1000 ký tự bị cắt còn 1000 + `…`; tiêu đề tự lấy từ dòng đầu của `text` (cắt 120 ký tự).

## 3. Ví dụ

```bash
curl -sS -X POST "https://<project>.supabase.co/functions/v1/ingest-facebook" \
  -H "x-ingest-secret: $INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "posts": [
      {
        "group_id": "1385451906420187",
        "post_id": "1234567890",
        "text": "Tặng 50 credit Claude Code cho anh em...\nChi tiết ở comment",
        "permalink": "https://www.facebook.com/groups/1385451906420187/posts/1234567890",
        "author": "Nguyen Van A",
        "created_at": "2026-10-19T09:30:00+07:00",
        "reactions": 42,
        "comments": 12
      }
    ]
  }'
```

## 4. Response

```json
{
  "ok": true,
  "received": 1,
  "fetched": 1,
  "inserted": 1,
  "deduped": 0,
  "skipped": 0,
  "skipped_details": [],
  "unknown_groups": [],
  "groups": [
    { "group_id": "1385451906420187", "name": "Vibe Code kiếm cơm", "fetched": 1, "inserted": 1, "deduped": 0 }
  ]
}
```

| HTTP | Khi nào |
|---|---|
| 200 | Xử lý xong (kể cả khi vài bài bị bỏ qua — xem `skipped_details`) |
| 400 | Body không phải JSON hợp lệ |
| 401 | Thiếu / sai `x-ingest-secret` |
| 405 | Không phải POST |
| 500 | Lỗi phía server (chưa cấu hình secret, lỗi DB...) |

## 5. Group đã seed

| Group | `group_id` |
|---|---|
| Vibe Code kiếm cơm | `1385451906420187` |
| Antigravity VN | `1522144709086429` |
| Cộng đồng Claude AI & AI Agents Việt Nam | `861108920047086` |

Muốn thêm group: insert 1 dòng `sources` (`type='facebook'`, `config={"group_id":"..."}`, `enabled=true`) — endpoint tự nhận, không cần sửa code.

## 6. Test local

```bash
cd supabase/functions/ingest-facebook
deno run --allow-net --allow-env --allow-read index.ts --once sample-payload.json
```
