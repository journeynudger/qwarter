import { createElement, type ReactNode } from "react";

/*
 * A page's body is carried as the markup the reference design's own browser
 * produced (content/pages/<slug>.html). To render it with no wrapper element
 * of ours in between (the design's CSS may select `body > …`), each top-level
 * element becomes one React element whose inner HTML is set verbatim.
 *
 * The input is serializer output (outerHTML of a live DOM, or markup written in
 * the same shape): every non-void element is closed and every attribute value
 * is quoted. That is all this tokenizer has to understand.
 */

export interface TopNode {
  tag: string;
  attrs: [string, string][];
  inner: string;
}

const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
]);
// Their content is text up to the matching close tag, whatever it contains.
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript"]);

const NAME = /[A-Za-z][^\s/>]*/y;
const ATTR = /\s*([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ent.toLowerCase()] ?? whole;
  });
}

/** Read the start tag at `at` (which points at "<"). */
function readStartTag(html: string, at: number): { tag: string; attrs: [string, string][]; end: number; selfClosing: boolean } {
  NAME.lastIndex = at + 1;
  const name = NAME.exec(html);
  if (!name) throw new Error(`html: expected a tag name at ${at}: ${html.slice(at, at + 40)}`);
  const attrs: [string, string][] = [];
  let i = NAME.lastIndex;
  for (;;) {
    while (/\s/.test(html[i] ?? "")) i++;
    if (html[i] === ">") return { tag: name[0].toLowerCase(), attrs, end: i + 1, selfClosing: false };
    if (html.startsWith("/>", i)) return { tag: name[0].toLowerCase(), attrs, end: i + 2, selfClosing: true };
    ATTR.lastIndex = i;
    const m = ATTR.exec(html);
    if (!m || ATTR.lastIndex === i) throw new Error(`html: unreadable attribute at ${i}: ${html.slice(i, i + 40)}`);
    attrs.push([m[1].toLowerCase(), decodeEntities(m[2] ?? m[3] ?? m[4] ?? "")]);
    i = ATTR.lastIndex;
  }
}

/** Index just past the close tag that matches the element opened before `from`. */
function findClose(html: string, tag: string, from: number): { innerEnd: number; end: number } {
  if (RAW_TEXT.has(tag)) {
    const re = new RegExp(`</${tag}\\s*>`, "ig");
    re.lastIndex = from;
    const m = re.exec(html);
    if (!m) throw new Error(`html: <${tag}> is never closed`);
    return { innerEnd: m.index, end: m.index + m[0].length };
  }
  let depth = 1;
  let i = from;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) break;
    if (html.startsWith("<!--", lt)) {
      const close = html.indexOf("-->", lt + 4);
      if (close < 0) throw new Error("html: comment is never closed");
      i = close + 3;
      continue;
    }
    if (html[lt + 1] === "/") {
      const gt = html.indexOf(">", lt);
      const name = html.slice(lt + 2, gt).trim().toLowerCase();
      if (name === tag && --depth === 0) return { innerEnd: lt, end: gt + 1 };
      i = gt + 1;
      continue;
    }
    if (/[A-Za-z]/.test(html[lt + 1] ?? "")) {
      const start = readStartTag(html, lt);
      if (start.tag === tag && !start.selfClosing && !VOID.has(start.tag)) depth++;
      else if (RAW_TEXT.has(start.tag) && !start.selfClosing) {
        i = findClose(html, start.tag, start.end).end;
        continue;
      }
      i = start.end;
      continue;
    }
    i = lt + 1;
  }
  throw new Error(`html: <${tag}> is never closed`);
}

/**
 * Split markup into its top-level elements. Whitespace and comments between
 * them are dropped; any other top-level text is an error (it would have no
 * element to live in).
 */
export function splitTopLevel(html: string): TopNode[] {
  const nodes: TopNode[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    const text = html.slice(i, lt < 0 ? html.length : lt);
    if (text.trim()) throw new Error(`html: text outside any element: "${text.trim().slice(0, 60)}"`);
    if (lt < 0) break;
    if (html.startsWith("<!--", lt)) {
      const close = html.indexOf("-->", lt + 4);
      if (close < 0) throw new Error("html: comment is never closed");
      i = close + 3;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      i = html.indexOf(">", lt) + 1;
      continue;
    }
    const start = readStartTag(html, lt);
    if (start.selfClosing || VOID.has(start.tag)) {
      nodes.push({ tag: start.tag, attrs: start.attrs, inner: "" });
      i = start.end;
      continue;
    }
    const close = findClose(html, start.tag, start.end);
    nodes.push({ tag: start.tag, attrs: start.attrs, inner: html.slice(start.end, close.innerEnd) });
    i = close.end;
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Attributes → React props. React wants a few names spelled its way; anything
// else (data-*, aria-*, role, id, unknown lowercase attributes) passes as is.
// ---------------------------------------------------------------------------

const RENAME: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  srcset: "srcSet",
  crossorigin: "crossOrigin",
  autoplay: "autoPlay",
  playsinline: "playsInline",
  readonly: "readOnly",
  maxlength: "maxLength",
  minlength: "minLength",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  contenteditable: "contentEditable",
  enctype: "encType",
  formaction: "formAction",
  frameborder: "frameBorder",
  allowfullscreen: "allowFullScreen",
  referrerpolicy: "referrerPolicy",
  fetchpriority: "fetchPriority",
  spellcheck: "spellCheck",
  colspan: "colSpan",
  rowspan: "rowSpan",
  datetime: "dateTime",
  inputmode: "inputMode",
  "accept-charset": "acceptCharset",
  "http-equiv": "httpEquiv",
  "xlink:href": "xlinkHref",
  "xml:lang": "xmlLang",
  "xmlns:xlink": "xmlnsXlink",
  viewbox: "viewBox",
};
const BOOLEAN = new Set([
  "hidden", "disabled", "checked", "selected", "multiple", "muted", "loop", "controls", "open", "required",
  "novalidate", "async", "defer", "nomodule", "playsinline", "autoplay", "readonly", "autofocus", "allowfullscreen", "inert",
]);

/** Split declarations on semicolons outside quotes and parentheses (data: URLs carry their own). */
function declarations(css: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) {
      out.push(css.slice(start, i));
      start = i + 1;
    }
  }
  out.push(css.slice(start));
  return out;
}

export function styleObject(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of declarations(css)) {
    const colon = decl.indexOf(":");
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim();
    const value = decl.slice(colon + 1).trim();
    if (!prop || !value) continue;
    // custom properties keep their name; everything else is camelCased (-webkit-x → WebkitX, -ms-x → msX)
    const key = prop.startsWith("--")
      ? prop
      : prop.toLowerCase().replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = value;
  }
  return out;
}

export function reactProps(attrs: [string, string][]): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [name, value] of attrs) {
    if (name.startsWith("on")) continue; // inline handlers do not survive React; the page's scripts bind their own
    if (name === "style") props.style = styleObject(value);
    else if (BOOLEAN.has(name)) props[RENAME[name] ?? name] = true;
    else props[RENAME[name] ?? name] = value;
  }
  return props;
}

/** The body markup as React elements, top-level element for top-level element. */
export function renderMarkup(html: string): ReactNode[] {
  return splitTopLevel(html).map((node, i) => {
    const props: Record<string, unknown> = { key: i, ...reactProps(node.attrs) };
    if (VOID.has(node.tag)) return createElement(node.tag, props);
    // the browser parses the inner HTML (inline <script>s included) on a full page load, as on the reference site
    props.dangerouslySetInnerHTML = { __html: node.inner };
    // scripts and styles must not be touched by hydration
    if (node.tag === "script" || node.tag === "style") props.suppressHydrationWarning = true;
    return createElement(node.tag, props);
  });
}
