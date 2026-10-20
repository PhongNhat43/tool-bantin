import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SourceRef = { name: string; type: string };

type ItemRow = {
  id: string;
  title: string;
  url: string;
  score: number;
  published_at: string | null;
  sources: SourceRef | SourceRef[] | null;
};

function sourceName(source: ItemRow["sources"]): string {
  if (!source) return "không rõ nguồn";
  if (Array.isArray(source)) return source[0]?.name ?? "không rõ nguồn";
  return source.name;
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("items")
    .select("id, title, url, score, published_at, sources(name, type)")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(10);

  const items = (data ?? []) as unknown as ItemRow[];

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>Bản tin AI</h1>
          <p className="muted">{user.email}</p>
        </div>
        <LogoutButton />
      </header>

      <h2>10 tin mới nhất</h2>

      {error ? (
        <p className="error">Lỗi đọc DB: {error.message}</p>
      ) : items.length === 0 ? (
        <p className="muted">Chưa có item nào trong DB.</p>
      ) : (
        <ol className="item-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="score">{item.score}</span>
              <div>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
                <p className="meta">
                  {sourceName(item.sources)}
                  {item.published_at
                    ? ` · ${new Date(item.published_at).toLocaleString("vi-VN")}`
                    : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
