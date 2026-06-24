/* ── HTML 转义 ────────────────────────────────────────── */
function escapeHTML(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ── Markdown 渲染器 ─────────────────────────────────── */
function mdToHTML(text) {
  if (!text) return "";
  if (typeof marked !== "undefined") {
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(text);
  }
  return escapeHTML(text);
}
