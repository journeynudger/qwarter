/**
 * The body splitter: every page is rendered through it, so a markup shape it
 * misreads would drop or merge part of a page.
 *
 * Run: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeEntities, reactProps, splitTopLevel, styleObject } from "@/lib/html";

test("top-level elements come out whole, nested ones stay inside", () => {
  const nodes = splitTopLevel(`
    <!-- header -->
    <header class="nav"><div><div>a</div></div><a href="/x/">x</a></header>
    <main id="main" data-scroll-container=""><section><p>one</p><p>two</p></section></main>
    <footer>f</footer>`);
  assert.deepEqual(nodes.map((n) => n.tag), ["header", "main", "footer"]);
  assert.equal(nodes[0].inner, `<div><div>a</div></div><a href="/x/">x</a>`);
  assert.deepEqual(nodes[1].attrs, [["id", "main"], ["data-scroll-container", ""]]);
  assert.equal(nodes[1].inner, "<section><p>one</p><p>two</p></section>");
});

test("script and style bodies are raw text, whatever they contain", () => {
  const nodes = splitTopLevel(
    `<script>if (a < b && "</div>") { document.write("<div>") }</script><style>.a>.b{c:d}</style><div>ok</div>`,
  );
  assert.deepEqual(nodes.map((n) => n.tag), ["script", "style", "div"]);
  assert.equal(nodes[0].inner, `if (a < b && "</div>") { document.write("<div>") }`);
  assert.equal(nodes[2].inner, "ok");
});

test("a script inside an element does not end it early", () => {
  const nodes = splitTopLevel(`<div class="w"><script>var s = "</span></div>";</script><span>in</span></div><p>out</p>`);
  assert.deepEqual(nodes.map((n) => n.tag), ["div", "p"]);
  assert.match(nodes[0].inner, /<span>in<\/span>$/);
});

test("void and self-closed elements, attribute quoting, entities", () => {
  const nodes = splitTopLevel(`<img src="/a.jpg" alt='A &amp; B' loading=lazy><svg viewBox="0 0 1 1"><path d="M0 0"/></svg><br/>`);
  assert.deepEqual(nodes.map((n) => n.tag), ["img", "svg", "br"]);
  assert.deepEqual(nodes[0].attrs, [["src", "/a.jpg"], ["alt", "A & B"], ["loading", "lazy"]]);
  assert.equal(nodes[1].inner, `<path d="M0 0"/>`);
});

test("text outside any element is refused, not silently dropped", () => {
  assert.throws(() => splitTopLevel(`<div></div> stray words <p></p>`), /text outside any element/);
  assert.throws(() => splitTopLevel(`<section><p>the section is never closed</p>`), /never closed/);
});

test("attributes become React props", () => {
  assert.deepEqual(reactProps([["class", "a b"], ["for", "x"], ["tabindex", "0"], ["data-w-id", "1"], ["onclick", "evil()"], ["hidden", ""]]), {
    className: "a b",
    htmlFor: "x",
    tabIndex: "0",
    "data-w-id": "1",
    hidden: true,
  });
  assert.deepEqual(
    styleObject(`opacity:0; -webkit-transform: translate3d(0, 10px, 0); --x: 1px ;background-image:url("data:image/svg+xml;utf8,<svg/>"); content: ";"`),
    {
      opacity: "0",
      WebkitTransform: "translate3d(0, 10px, 0)",
      "--x": "1px",
      backgroundImage: `url("data:image/svg+xml;utf8,<svg/>")`,
      content: `";"`,
    },
  );
  assert.equal(decodeEntities("&lt;a&gt; &#39;x&#x27; &unknown;"), "<a> 'x' &unknown;");
});
