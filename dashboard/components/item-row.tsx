"use client";

import { useState, type KeyboardEvent } from "react";
import {
  engagementParts,
  relativeTime,
  scoreBreakdown,
  scoreTier,
  sourceLine,
  truncate,
} from "@/lib/format";
import { sourceOf, type Item } from "@/lib/items";

const CONTENT_LIMIT = 500;

/** Một dòng tin kiểu Feedly: ô điểm bên trái, tiêu đề + meta bên phải. */
export function ItemRow({
  item,
  read = false,
  onRead,
}: {
  item: Item;
  read?: boolean;
  onRead?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const hot = item.score >= 70;
  const source = sourceOf(item);
  const breakdown = scoreBreakdown(item.engagement);
  const engagement = engagementParts(item.engagement);
  const content = item.content?.trim();

  function toggle() {
    // Mở rộng lần đầu = đánh dấu đã đọc ngay lúc đó.
    if (!open) onRead?.(item.id);
    setOpen((value) => !value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  }

  return (
    <article
      className={`item ${hot ? "hot" : ""} ${open ? "open" : ""} ${read ? "" : "unread"}`}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={toggle}
      onKeyDown={onKeyDown}
    >
      <div className={`score ${scoreTier(item.score)}`}>{item.score}</div>

      <div className="body">
        <h3>
          {read ? null : (
            <span className="unread-dot" title="Chưa đọc" aria-hidden="true" />
          )}
          {item.title}
        </h3>
        <div className="meta">
          <span>{sourceLine(source?.name, source?.type)}</span>
          <span>·</span>
          <span>{relativeTime(item.published_at)}</span>
        </div>

        {open ? (
          <div className="detail">
            {content ? (
              <p className="desc">{truncate(content, CONTENT_LIMIT)}</p>
            ) : (
              <p className="desc muted">Bài gốc không có nội dung tóm tắt.</p>
            )}

            {breakdown ? (
              <div className="breakdown">
                <span>
                  Chủ đề <b>{breakdown.topic}</b>/40
                </span>
                <span>
                  Tương tác <b>{breakdown.engagement}</b>/30
                </span>
                <span>
                  Độ mới <b>{breakdown.recency}</b>/20
                </span>
                <span>
                  Cross-source <b>{breakdown.cross_source}</b>/10
                </span>
              </div>
            ) : (
              <p className="breakdown">Chưa có breakdown điểm cho tin này.</p>
            )}

            {engagement.length > 0 ? (
              <div className="engagement">
                {engagement.map((part) => (
                  <span key={part}>{part}</span>
                ))}
              </div>
            ) : null}

            {item.author ? (
              <div className="engagement">
                <span>tác giả: {item.author}</span>
              </div>
            ) : null}

            <a
              className="open-link"
              href={item.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              Mở bài gốc ↗
            </a>
          </div>
        ) : null}
      </div>
    </article>
  );
}
