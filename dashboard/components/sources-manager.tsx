"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { typeLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  buildNewSource,
  configSummary,
  createSource,
  fetchManagedSources,
  setSourceEnabled,
  writeErrorText,
  type ManagedSource,
  type NewSourceForm,
  type NewSourceType,
} from "@/lib/sources";

type Loaded = { key: number; sources: ManagedSource[]; error: string };

const EMPTY_FORM: NewSourceForm = {
  type: "github",
  githubQuery: "",
  githubMinStars: "50",
  githubDays: "14",
  hnQueries: "",
  hnMinPoints: "30",
  rssName: "",
  rssFeedUrl: "",
};

const FACEBOOK_NOTE =
  "Nguồn bị động — Merlin quét hộ theo lịch riêng, muốn thêm group mới thì báo Merlin";

const FACEBOOK_FORM_NOTE =
  "Nguồn Facebook không thêm ở đây — Merlin quét hộ theo lịch riêng, muốn thêm group mới thì báo Merlin.";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setField<K extends keyof NewSourceForm>(
  current: NewSourceForm,
  key: K,
  value: NewSourceForm[K],
): NewSourceForm {
  return { ...current, [key]: value };
}

/**
 * Trang quản lý nguồn: danh sách + bật/tắt + form thêm nguồn.
 *
 * Facebook là nguồn BỊ ĐỘNG: ingest nằm ngoài run-cycle (Merlin POST vào
 * ingest-facebook), nên `enabled` không có tác dụng với nó -> chỉ hiển thị,
 * không toggle, không cho thêm qua form (DECISIONS #52).
 */
export function SourcesManager() {
  const client = useMemo(() => createClient(), []);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<NewSourceForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    fetchManagedSources(client)
      .then((sources) => {
        if (active) setLoaded({ key: version, sources, error: "" });
      })
      .catch((error: unknown) => {
        if (active) {
          setLoaded({ key: version, sources: [], error: errorMessage(error) });
        }
      });

    return () => {
      active = false;
    };
  }, [client, version]);

  const loading = loaded?.key !== version;
  const sources = loading ? [] : loaded.sources;
  const listError = loading ? "" : loaded.error;

  async function toggle(source: ManagedSource) {
    if (busyId) return;

    const next = !source.enabled;
    setBusyId(source.id);
    setRowErrors((current) => {
      const copy = { ...current };
      delete copy[source.id];
      return copy;
    });

    try {
      await setSourceEnabled(client, source.id, next);
      setLoaded((current) =>
        current
          ? {
              ...current,
              sources: current.sources.map((row) =>
                row.id === source.id ? { ...row, enabled: next } : row,
              ),
            }
          : current,
      );
    } catch (error: unknown) {
      setRowErrors((current) => ({
        ...current,
        [source.id]: writeErrorText(errorMessage(error)),
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const built = buildNewSource(form);
    if (!built.ok) {
      setFormError(built.error);
      setFormOk("");
      return;
    }

    setSaving(true);
    setFormError("");
    setFormOk("");

    try {
      const created = await createSource(client, built.value);
      setForm((current) => ({
        ...current,
        githubQuery: "",
        githubMinStars: "50",
        githubDays: "14",
        hnQueries: "",
        hnMinPoints: "30",
        rssName: "",
        rssFeedUrl: "",
      }));
      setFormOk(
        `Đã thêm nguồn “${created.name}”. Kỳ quét tới sẽ tự đọc nguồn này.`,
      );
      setVersion((value) => value + 1);
    } catch (error: unknown) {
      setFormError(writeErrorText(errorMessage(error)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1 className="section-title">
        Quản lý nguồn
        <span className="count">{loading ? "…" : sources.length}</span>
      </h1>

      {loading ? (
        <p className="state">Đang tải nguồn…</p>
      ) : listError ? (
        <p className="state state-error">Lỗi đọc bảng sources: {listError}</p>
      ) : sources.length === 0 ? (
        <p className="state">Chưa có nguồn nào trong DB.</p>
      ) : (
        sources.map((source) => {
          const passive = source.type === "facebook";
          const busy = busyId === source.id;
          const config = configSummary(source.config);
          const countText =
            source.itemCount === null ? "? tin" : `${source.itemCount} tin`;

          return (
            <div
              key={source.id}
              className={`source-row ${source.enabled ? "" : "off"}`}
            >
              <div className="info">
                <div className="name">{source.name}</div>
                <div className="sub">{countText} đã thu thập</div>

                {config.length > 0 ? (
                  <div className="config">
                    {config.map((entry) => (
                      <span className="config-item" key={entry.key}>
                        {entry.key}: {entry.value}
                      </span>
                    ))}
                  </div>
                ) : null}

                {passive ? <p className="source-note">{FACEBOOK_NOTE}</p> : null}

                {rowErrors[source.id] ? (
                  <p className="source-error" role="alert">
                    {rowErrors[source.id]}
                  </p>
                ) : null}
              </div>

              <span className="badge">{typeLabel(source.type)}</span>

              {passive ? (
                <span className="source-passive">bị động</span>
              ) : (
                <span className="toggle-box">
                  <button
                    type="button"
                    className={`toggle ${source.enabled ? "" : "off"}`}
                    role="switch"
                    aria-checked={source.enabled}
                    aria-label={`${source.enabled ? "Tắt" : "Bật"} nguồn ${source.name}`}
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => toggle(source)}
                  />
                  {busy ? (
                    <span className="toggle-state">Đang lưu…</span>
                  ) : null}
                </span>
              )}
            </div>
          );
        })
      )}

      <div className="add-form">
        <h3>＋ Thêm nguồn mới</h3>

        <form onSubmit={submit} noValidate>
          <div className="form-row">
            <label className="field field-narrow">
              <span>Loại nguồn</span>
              <select
                value={form.type}
                onChange={(event) => {
                  setForm((current) =>
                    setField(
                      current,
                      "type",
                      event.target.value as NewSourceType,
                    ),
                  );
                  // Đổi loại nguồn thì lỗi/thông báo của form cũ không còn đúng.
                  setFormError("");
                  setFormOk("");
                }}
              >
                <option value="github">GitHub</option>
                <option value="hackernews">Hacker News</option>
                <option value="rss">RSS / Atom</option>
              </select>
            </label>
          </div>

          {form.type === "github" ? (
            <>
              <div className="form-row">
                <label className="field">
                  <span>Query *</span>
                  <input
                    type="text"
                    value={form.githubQuery}
                    onChange={(event) =>
                      setForm((current) =>
                        setField(current, "githubQuery", event.target.value),
                      )
                    }
                    placeholder='vd: "mcp server"'
                  />
                </label>
                <label className="field field-narrow">
                  <span>Min stars</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.githubMinStars}
                    onChange={(event) =>
                      setForm((current) =>
                        setField(
                          current,
                          "githubMinStars",
                          event.target.value,
                        ),
                      )
                    }
                    placeholder="50"
                  />
                </label>
                <label className="field field-narrow">
                  <span>Số ngày</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.githubDays}
                    onChange={(event) =>
                      setForm((current) =>
                        setField(current, "githubDays", event.target.value),
                      )
                    }
                    placeholder="14"
                  />
                </label>
              </div>
              <p className="field-hint">
                Tên lưu vào DB: GitHub · {form.githubQuery.trim() || "…"}
              </p>
            </>
          ) : null}

          {form.type === "hackernews" ? (
            <>
              <div className="form-row">
                <label className="field">
                  <span>Queries (phân cách bằng dấu phẩy) *</span>
                  <input
                    type="text"
                    value={form.hnQueries}
                    onChange={(event) =>
                      setForm((current) =>
                        setField(current, "hnQueries", event.target.value),
                      )
                    }
                    placeholder="Claude Code, AI coding"
                  />
                </label>
                <label className="field field-narrow">
                  <span>Min points</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.hnMinPoints}
                    onChange={(event) =>
                      setForm((current) =>
                        setField(current, "hnMinPoints", event.target.value),
                      )
                    }
                    placeholder="30"
                  />
                </label>
              </div>
              <p className="field-hint">
                Tên lưu vào DB: Hacker News ·{" "}
                {form.hnQueries
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .join(", ") || "…"}
              </p>
            </>
          ) : null}

          {form.type === "rss" ? (
            <>
              <div className="form-row">
                <label className="field">
                  <span>Tên nguồn *</span>
                  <input
                    type="text"
                    value={form.rssName}
                    onChange={(event) =>
                      setForm((current) =>
                        setField(current, "rssName", event.target.value),
                      )
                    }
                    placeholder="vd: Blog của Simon Willison"
                  />
                </label>
              </div>
              <div className="form-row">
                <label className="field">
                  <span>Feed URL (RSS / Atom) *</span>
                  <input
                    type="url"
                    value={form.rssFeedUrl}
                    onChange={(event) =>
                      setForm((current) =>
                        setField(current, "rssFeedUrl", event.target.value),
                      )
                    }
                    placeholder="https://example.com/feed.xml"
                  />
                </label>
              </div>
            </>
          ) : null}

          <p className="form-note">{FACEBOOK_FORM_NOTE}</p>

          {formError ? (
            <p className="error" role="alert">
              {formError}
            </p>
          ) : null}

          {formOk ? (
            <p className="notice" role="status">
              {formOk}
            </p>
          ) : null}

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? "Đang lưu…" : "Lưu nguồn"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
