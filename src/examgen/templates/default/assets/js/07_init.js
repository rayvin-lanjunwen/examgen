/* ── 页面加载 ───────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
  buildNavSidebar(EXAM_DATA);
  renderQuestions(EXAM_DATA);
  submitBtn.addEventListener("click", onSubmit);
  resetBtn.addEventListener("click", onReset);
  if (gradingDoneBtn) gradingDoneBtn.addEventListener("click", onGradingDone);

  if (EXAM_META && EXAM_META.time) {
    startCountdown(EXAM_META.time * 60);
  } else {
    timerBar.style.display = "none";
  }

  container.addEventListener("change", updateProgress);
  container.addEventListener("input",  updateProgress);
  window.addEventListener("scroll", function () {
    highlightCurrentNav();
    if (gradingActive) updateGradingFocus();
  });

  // CDN 加载失败检测
  setTimeout(function () {
    var warnings = [];
    if (typeof renderMathInElement === "undefined") {
      warnings.push("数学公式渲染（KaTeX）");
    }
    if (typeof marked === "undefined") {
      warnings.push("Markdown 渲染（marked）");
    }
    if (warnings.length > 0) {
      showCDNFallback(warnings);
    }
  }, 3000);
});

/* ── CDN 加载失败提示 ──────────────────────────────── */
function showCDNFallback(missing) {
  var banner = document.createElement("div");
  banner.className = "cdn-fallback-banner";
  banner.innerHTML =
    "<strong>离线提示</strong> " +
    "当前处于离线状态，以下功能不可用：" +
    missing.join("、") +
    "。公式/解析将以纯文本显示。";
  var main = document.querySelector(".main-content");
  if (main) main.insertBefore(banner, main.firstChild);
}
