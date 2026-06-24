/* ── HTML 转义 ────────────────────────────────────────── */
function escapeHTML(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ── Markdown 渲染器 ─────────────────────────────────── */
function mdToHTML(text) {
  if (!text) return "";
  if (typeof marked === "undefined") {
    return escapeHTML(text);
  }

  marked.setOptions({ breaks: true, gfm: true });

  // 保护 LaTeX 公式，防止 marked.js 将 _ 解析为斜体、* 解析为粗体等
  var mathBlocks = [];

  // 1) 保护块级公式 $$...$$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, function (match) {
    mathBlocks.push(match);
    return "\uFFF0D" + (mathBlocks.length - 1) + "D\uFFF0";
  });

  // 2) 保护行内公式 $...$（非贪婪匹配，内容不含 $）
  text = text.replace(/\$([^$]+?)\$/g, function (match) {
    mathBlocks.push(match);
    return "\uFFF0I" + (mathBlocks.length - 1) + "I\uFFF0";
  });

  var html = marked.parse(text);

  // 还原公式
  html = html.replace(/\uFFF0D(\d+)D\uFFF0/g, function (_, idx) {
    return mathBlocks[parseInt(idx)];
  });
  html = html.replace(/\uFFF0I(\d+)I\uFFF0/g, function (_, idx) {
    return mathBlocks[parseInt(idx)];
  });

  return html;
}
