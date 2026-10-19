/**
 * Parser XML tối giản cho RSS/Atom — KHÔNG dùng dependency ngoài.
 *
 * Vì sao tự viết: Deno 2.9.7 KHÔNG có `DOMParser` / `XMLSerializer` / `Document`
 * (đã kiểm chứng thật: `typeof DOMParser === "undefined"`, kể cả khi chạy file
 * `.ts` riêng hay thêm cờ `--unstable*`). AGENTS.md mục 1 cấm thêm lib mới khi
 * chưa hỏi, nên parser này thay thế đúng vai trò của DOMParser cho nhu cầu đọc
 * feed RSS/Atom. Xem DECISIONS #23.
 *
 * Phạm vi: đủ dùng cho RSS 2.0 / Atom / RDF. Có xử lý CDATA, comment, DOCTYPE
 * (kể cả internal subset), entity (5 entity XML + numeric + vài entity HTML
 * thường gặp trong feed).
 *
 * KHÔNG phải XML parser tổng quát:
 * - Không resolve namespace — chỉ lột prefix (`dc:creator` -> `creator`).
 * - Không validate DTD, không expand entity tự định nghĩa.
 * - Không xử lý attribute trùng tên sau khi lột prefix (lấy cái sau).
 */

/** 1 element trong cây XML. `name` là local name (đã lột prefix namespace). */
export interface XmlNode {
  /** Tên element đã lột prefix namespace, vd "entry", "creator". */
  name: string;
  /** Attribute đã lột prefix + giải entity. */
  attrs: Record<string, string>;
  /** Element con, giữ nguyên thứ tự trong tài liệu. */
  children: XmlNode[];
  /**
   * Text TRỰC TIẾP của element này (đã giải entity), CHƯA trim.
   * Text nằm trong element con KHÔNG được gộp vào đây — muốn cả cây dùng `textContent()`.
   */
  text: string;
}

/**
 * Entity có tên cần giải. Thiếu bảng này thì các entity HTML phổ biến trong feed
 * (`&nbsp;`, `&mdash;`…) sẽ bị giữ nguyên dạng `&nbsp;` và lọt vào tiêu đề.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  ensp: "\u2002",
  emsp: "\u2003",
  thinsp: "\u2009",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  laquo: "\u00ab",
  raquo: "\u00bb",
  times: "\u00d7",
  middot: "\u00b7",
  bull: "\u2022",
  deg: "\u00b0",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  euro: "\u20ac",
  pound: "\u00a3",
  yen: "\u00a5",
  sect: "\u00a7",
  para: "\u00b6",
};

/** Bỏ prefix namespace: `dc:creator` -> `creator`, `entry` -> `entry`. */
function localName(rawName: string): string {
  const idx = rawName.lastIndexOf(":");
  return idx === -1 ? rawName : rawName.slice(idx + 1);
}

/**
 * Giải entity trong text/attribute.
 * Entity lạ (không biết tên, không phải numeric) được GIỮ NGUYÊN thay vì throw —
 * feed thật có nhiều entity rác, throw sẽ làm chết cả feed vì 1 ký tự.
 */
export function decodeEntities(raw: string): string {
  if (!raw.includes("&")) return raw;

  return raw.replace(
    /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, body: string) => {
      if (body.startsWith("#")) {
        const isHex = body[1] === "x" || body[1] === "X";
        const code = Number.parseInt(
          isHex ? body.slice(2) : body.slice(1),
          isHex ? 16 : 10,
        );
        if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }

      const known = NAMED_ENTITIES[body];
      return known === undefined ? match : known;
    },
  );
}

/** Lỗi kèm vị trí (dòng + offset) để biết feed hỏng ở đâu. */
function errorAt(source: string, pos: number, message: string): Error {
  const line = source.slice(0, pos).split("\n").length;
  return new Error(`XML lỗi (dòng ${line}, offset ${pos}): ${message}`);
}

function isWhitespaceCode(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

/**
 * Bỏ qua `<!DOCTYPE ...>` — kể cả khi có internal subset `[ <!ENTITY ...> ]`
 * (gặp trong vài feed RSS cũ). Trả về vị trí ngay sau `>` đóng.
 */
function skipDoctype(xml: string, start: number): number {
  let i = start + 2;
  let bracketDepth = 0;

  while (i < xml.length) {
    const ch = xml[i];
    if (ch === "[") {
      bracketDepth++;
    } else if (ch === "]") {
      bracketDepth--;
    } else if (ch === ">" && bracketDepth <= 0) {
      return i + 1;
    }
    i++;
  }

  throw errorAt(xml, start, "DOCTYPE không đóng");
}

/**
 * Parse chuỗi XML, trả về element gốc.
 *
 * @throws Error khi XML hỏng (thẻ không khớp, thẻ chưa đóng, attribute sai cú pháp).
 */
export function parseXml(source: string): XmlNode {
  // BOM ở đầu file làm tên thẻ đầu tiên bị dính ký tự lạ.
  const xml = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;

  // Node giả đại diện cả document; text ngoài element gốc rơi vào đây và bị bỏ.
  const documentRoot: XmlNode = {
    name: "#document",
    attrs: {},
    children: [],
    text: "",
  };
  const stack: XmlNode[] = [documentRoot];
  const len = xml.length;
  let i = 0;

  const appendText = (raw: string): void => {
    if (raw === "") return;
    stack[stack.length - 1].text += decodeEntities(raw);
  };

  while (i < len) {
    const lt = xml.indexOf("<", i);

    // Hết thẻ: phần còn lại là text của element đang mở.
    if (lt === -1) {
      appendText(xml.slice(i));
      break;
    }

    if (lt > i) appendText(xml.slice(i, lt));

    // <!-- comment -->
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      if (end === -1) throw errorAt(xml, lt, "comment không đóng");
      i = end + 3;
      continue;
    }

    // <![CDATA[ ... ]]> — nội dung lấy nguyên văn, KHÔNG giải entity.
    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      if (end === -1) throw errorAt(xml, lt, "CDATA không đóng");
      stack[stack.length - 1].text += xml.slice(lt + 9, end);
      i = end + 3;
      continue;
    }

    // <?xml ... ?> hoặc processing instruction khác -> bỏ.
    if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt + 2);
      if (end === -1) throw errorAt(xml, lt, "processing instruction không đóng");
      i = end + 2;
      continue;
    }

    // <!DOCTYPE ...>
    if (xml.startsWith("<!", lt)) {
      i = skipDoctype(xml, lt);
      continue;
    }

    // </name> — thẻ đóng.
    if (xml.startsWith("</", lt)) {
      const end = xml.indexOf(">", lt + 2);
      if (end === -1) throw errorAt(xml, lt, "thẻ đóng không đóng");

      const rawName = xml.slice(lt + 2, end).trim();
      const name = localName(rawName);
      const top = stack.pop();

      if (!top || top.name !== name) {
        throw errorAt(
          xml,
          lt,
          `thẻ đóng </${rawName}> không khớp với <${top?.name ?? "(không còn thẻ mở)"}>`,
        );
      }
      i = end + 1;
      continue;
    }

    // <name attr="value" ...> hoặc <name ... />
    let j = lt + 1;
    let k = j;
    while (k < len && !isWhitespaceCode(xml.charCodeAt(k)) && xml[k] !== "/" && xml[k] !== ">") {
      k++;
    }

    const rawName = xml.slice(j, k);
    if (rawName === "") throw errorAt(xml, lt, "thẻ mở không có tên");
    j = k;

    const node: XmlNode = {
      name: localName(rawName),
      attrs: {},
      children: [],
      text: "",
    };

    let selfClosing = false;

    while (j < len) {
      while (j < len && isWhitespaceCode(xml.charCodeAt(j))) j++;

      if (j >= len) throw errorAt(xml, lt, `thẻ <${rawName}> không đóng`);

      if (xml[j] === ">") {
        j++;
        break;
      }

      if (xml[j] === "/") {
        // XML yêu cầu "/>" liền nhau, nhưng vài generator chèn khoảng trắng.
        j++;
        while (j < len && isWhitespaceCode(xml.charCodeAt(j))) j++;
        if (xml[j] !== ">") throw errorAt(xml, j, `"<${rawName}>": "/" không theo sau bởi ">"`);
        selfClosing = true;
        j++;
        break;
      }

      // Tên attribute.
      let a = j;
      while (
        a < len &&
        !isWhitespaceCode(xml.charCodeAt(a)) &&
        xml[a] !== "=" &&
        xml[a] !== "/" &&
        xml[a] !== ">"
      ) {
        a++;
      }

      const rawAttr = xml.slice(j, a);
      if (rawAttr === "") throw errorAt(xml, j, `"<${rawName}>" có attribute sai cú pháp`);
      j = a;

      while (j < len && isWhitespaceCode(xml.charCodeAt(j))) j++;

      let value = "";
      if (xml[j] === "=") {
        j++;
        while (j < len && isWhitespaceCode(xml.charCodeAt(j))) j++;

        const quote = xml[j];
        if (quote === '"' || quote === "'") {
          const endQuote = xml.indexOf(quote, j + 1);
          if (endQuote === -1) {
            throw errorAt(xml, j, `"<${rawName}>": giá trị attribute không đóng`);
          }
          value = xml.slice(j + 1, endQuote);
          j = endQuote + 1;
        } else {
          // Không chuẩn XML nhưng feed ngoài đời thỉnh thoảng có -> chấp nhận.
          let b = j;
          while (b < len && !isWhitespaceCode(xml.charCodeAt(b)) && xml[b] !== ">" && xml[b] !== "/") {
            b++;
          }
          value = xml.slice(j, b);
          j = b;
        }
      }

      node.attrs[localName(rawAttr)] = decodeEntities(value);
    }

    i = j;
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }

  if (stack.length !== 1) {
    throw errorAt(
      xml,
      len,
      `thiếu thẻ đóng cho <${stack[stack.length - 1].name}>`,
    );
  }

  const rootElement = documentRoot.children[0];
  if (!rootElement) throw new Error("XML không có element gốc");

  return rootElement;
}

/** Tìm MỌI element con (đệ quy) có local name khớp. Không tính chính `node`. */
export function findAll(node: XmlNode, name: string): XmlNode[] {
  const out: XmlNode[] = [];

  const walk = (current: XmlNode): void => {
    for (const child of current.children) {
      if (child.name === name) out.push(child);
      walk(child);
    }
  };

  walk(node);
  return out;
}

/** Element con TRỰC TIẾP đầu tiên có local name khớp. */
export function findFirst(node: XmlNode, name: string): XmlNode | undefined {
  return node.children.find((child) => child.name === name);
}

/** Giá trị attribute, đã giải entity. */
export function attr(node: XmlNode, name: string): string | undefined {
  return node.attrs[name];
}

/** Gộp text của cả cây con (text trực tiếp + mọi element con). */
export function textContent(node: XmlNode): string {
  let out = node.text;
  for (const child of node.children) out += textContent(child);
  return out;
}
