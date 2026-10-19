/**
 * Test cho `_shared/xml.ts`.
 *
 * Chạy: deno test --allow-net supabase/functions/_shared/xml_test.ts
 *
 * Test cuối (`feed thật`) cần mạng; các test còn lại chạy offline.
 * Không dùng thư viện assert ngoài (AGENTS.md mục 1) — tự viết `eq`/`throws`.
 */

import {
  attr,
  decodeEntities,
  findAll,
  findFirst,
  parseXml,
  textContent,
  type XmlNode,
} from "./xml.ts";

/** So sánh sâu bằng JSON; khác thì throw kèm nội dung mong đợi. */
function eq(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`mong đợi: ${e}\n        nhận được: ${a}`);
  }
}

/** Khẳng định `fn()` phải throw. */
function throws(fn: () => unknown): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error("đáng lẽ phải throw nhưng không throw");
}

/** Element rỗng giả để tránh phải `!` khi truyền vào helper. */
const EMPTY_NODE: XmlNode = { name: "", attrs: {}, children: [], text: "" };

Deno.test("decodeEntities: 5 entity XML, numeric, entity HTML, entity lạ", () => {
  eq(decodeEntities("a&amp;b&lt;c&gt;d&quot;e&apos;f"), `a&b<c>d"e'f`);
  eq(decodeEntities("&#65;&#66;"), "AB");
  eq(decodeEntities("&#x41;&#X42;"), "AB");
  eq(decodeEntities("x&nbsp;y&mdash;z"), "x\u00a0y\u2014z");
  // Entity lạ giữ nguyên: 1 ký tự rác không được làm chết cả feed.
  eq(decodeEntities("a&foo;b& b"), "a&foo;b& b");
  eq(decodeEntities("bình thường"), "bình thường");
});

Deno.test("Atom: entry, link rel=alternate, author, CDATA, comment", () => {
  const doc = parseXml(`<?xml version="1.0" encoding="utf-8"?>
<feed xml:lang="en-us" xmlns="http://www.w3.org/2005/Atom">
  <!-- comment xen giữa -->
  <title>Blog test</title>
  <link href="http://a.test/" rel="alternate"/>
  <updated>2026-10-18T23:43:09+00:00</updated>
  <entry>
    <title>Bài 1</title>
    <link href="https://a.test/1" rel="alternate"/>
    <published>2026-10-18T23:43:09+00:00</published>
    <id>https://a.test/1</id>
    <author><name>Tác giả</name></author>
    <summary type="html">&lt;p&gt;X &amp;amp; Y&lt;/p&gt;</summary>
  </entry>
  <entry>
    <title><![CDATA[Bài có CDATA & <thẻ> lạ]]></title>
    <link rel="alternate" href="https://a.test/2"/>
    <id>urn:uuid:abc-123</id>
    <published>2026-10-17T10:00:00Z</published>
  </entry>
</feed>`);

  eq(doc.name, "feed");

  const entries = findAll(doc, "entry");
  eq(entries.length, 2);

  // Comment không được sinh ra element nào.
  eq(findFirst(doc, "#comment"), undefined);

  const e1 = entries[0];
  eq(textContent(findFirst(e1, "title")!).trim(), "Bài 1");
  eq(textContent(findFirst(e1, "id")!).trim(), "https://a.test/1");
  eq(attr(findFirst(e1, "link")!, "href"), "https://a.test/1");
  eq(attr(findFirst(e1, "link")!, "rel"), "alternate");
  eq(textContent(findFirst(findFirst(e1, "author")!, "name")!).trim(), "Tác giả");
  eq(textContent(findFirst(e1, "summary")!).trim(), "<p>X &amp; Y</p>");

  const e2 = entries[1];
  eq(textContent(findFirst(e2, "title")!), "Bài có CDATA & <thẻ> lạ");
  // Attribute đảo thứ tự vẫn đọc được.
  eq(attr(findFirst(e2, "link")!, "href"), "https://a.test/2");
});

Deno.test("RSS 2.0: DOCTYPE internal subset, namespace dc:, attr không quote, thẻ rỗng", () => {
  const doc = parseXml(`<?xml version="1.0"?>
<!DOCTYPE rss PUBLIC "-//W3C//DTD RSS 2.0//EN" "http://a.test/rss.dtd" [
  <!ENTITY weird "bỏ qua">
]>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Blog ABC</title>
    <item>
      <title>Tin số 1 &amp; thử</title>
      <link>https://abc.test/1</link>
      <guid isPermaLink="true">https://abc.test/1</guid>
      <pubDate>Sat, 18 Oct 2026 23:43:09 +0000</pubDate>
      <dc:creator>Nguyễn Văn A</dc:creator>
      <description><![CDATA[<p>Mô tả có & ký tự</p>]]></description>
      <enclosure url="https://abc.test/a.mp3" type="audio/mpeg" length="0" />
    </item>
    <item>
      <title>Tin số 2</title>
      <link>https://abc.test/2</link>
      <guid>tag:abc.test,2026:2</guid>
    </item>
  </channel>
</rss>`);

  eq(doc.name, "rss");
  // Toàn bộ nội dung DOCTYPE (kể cả <!ENTITY>) phải bị bỏ qua.
  eq(findAll(doc, "ENTITY").length, 0);

  const items = findAll(doc, "item");
  eq(items.length, 2);

  const it1 = items[0];
  eq(textContent(findFirst(it1, "title")!).trim(), "Tin số 1 & thử");
  eq(textContent(findFirst(it1, "link")!).trim(), "https://abc.test/1");
  eq(textContent(findFirst(it1, "guid")!).trim(), "https://abc.test/1");
  eq(attr(findFirst(it1, "guid")!, "isPermaLink"), "true");
  eq(textContent(findFirst(it1, "pubDate")!).trim(), "Sat, 18 Oct 2026 23:43:09 +0000");
  // `dc:creator` -> lột prefix còn `creator`.
  eq(textContent(findFirst(it1, "creator")!).trim(), "Nguyễn Văn A");
  // Nội dung trong CDATA phải lấy nguyên văn, không giải entity, không lột thẻ.
  eq(textContent(findFirst(it1, "description")!), "<p>Mô tả có & ký tự</p>");
  eq(attr(findFirst(it1, "enclosure")!, "url"), "https://abc.test/a.mp3");
});

Deno.test("XML hỏng -> throw kèm vị trí", () => {
  throws(() => parseXml("<a><b></a></b>")); // thẻ đóng không khớp
  throws(() => parseXml("<a><b></b>")); // thiếu thẻ đóng
  throws(() => parseXml('<a b="chưa đóng>')); // attribute không đóng
  throws(() => parseXml("<a><![CDATA[x</a>")); // CDATA không đóng
  throws(() => parseXml('<?xml version="1.0"?><!-- chỉ comment -->')); // không có element gốc
});

Deno.test("feed THẬT: parse được feed Atom 100KB+ (cần mạng)", async () => {
  const res = await fetch("https://simonwillison.net/atom/everything/");
  eq(res.ok, true);

  const xml = await res.text();
  const doc = parseXml(xml);

  eq(doc.name, "feed");

  const entries = findAll(doc, "entry");
  if (entries.length === 0) throw new Error("feed thật không có entry nào");

  // Các field collector dựa vào phải có đủ trên MỌI entry.
  for (const entry of entries) {
    const title = textContent(findFirst(entry, "title") ?? EMPTY_NODE).trim();
    if (title === "") throw new Error("có entry không có title");

    const link = entry.children.find((c) => c.name === "link" && c.attrs.href);
    if (!link) throw new Error(`entry "${title}" không có <link href>`);

    if (!findFirst(entry, "published") && !findFirst(entry, "updated")) {
      throw new Error(`entry "${title}" không có published/updated`);
    }
  }

  // Feed khai author ở cấp FEED, không phải trong entry (đã kiểm chứng 0/30).
  const feedAuthor = findFirst(doc, "author");
  if (!feedAuthor) throw new Error("feed thật không khai author cấp feed");
  eq(textContent(findFirst(feedAuthor, "name")!).trim(), "Simon Willison");
});
