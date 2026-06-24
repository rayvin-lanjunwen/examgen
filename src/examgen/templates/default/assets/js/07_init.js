/* ── 页面加载 ───────────────────────────────────────── */
var _examId = ""; // 当前试卷唯一 ID（用于 localStorage 隔离）

document.addEventListener("DOMContentLoaded", function () {
  // 生成试卷唯一标识
  _examId = "examgen_" + (EXAM_META.title || "exam").replace(/[^a-zA-Z0-9]/g, "_");

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

  container.addEventListener("change", function(e) { updateProgress(); saveAnswersToStorage(); });
  container.addEventListener("input",  function(e) { updateProgress(); saveAnswersToStorage(); });
  window.addEventListener("scroll", function () {
    highlightCurrentNav();
    if (gradingActive) updateGradingFocus();
  });

  // 恢复已保存的答案
  restoreAnswersFromStorage();

  // 键盘快捷键
  document.addEventListener("keydown", onKeyDown);

  // 侧边栏折叠/展开
  var collapseBtn = document.getElementById("sidebarCollapseBtn");
  var sidebar = document.getElementById("sidebar");
  var mainContent = document.querySelector(".main-content");
  if (collapseBtn && sidebar) {
    collapseBtn.addEventListener("click", function () {
      sidebar.classList.toggle("collapsed");
      if (sidebar.classList.contains("collapsed")) {
        collapseBtn.innerHTML = "&#9654;";
        mainContent.style.marginLeft = "0";
      } else {
        collapseBtn.innerHTML = "&#9664;";
        mainContent.style.marginLeft = "";
      }
    });
  }

  // 手机端顶部操作栏
  var topbar = document.getElementById("mobileTopbar");
  var mtbHamburger = document.getElementById("mtbHamburgerBtn");
  var mtbSubmitBtn = document.getElementById("mtbSubmitBtn");
  var mtbProgress = document.getElementById("mtbProgress");
  var sidebarOverlay = document.getElementById("sidebarOverlay");
  if (mtbHamburger && sidebar) {
    mtbHamburger.addEventListener("click", function () {
      var isOpen = sidebar.classList.contains("open");
      if (isOpen) {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("show");
        mtbHamburger.textContent = "\u2630";
      } else {
        sidebar.classList.remove("collapsed");
        sidebar.classList.add("open");
        sidebarOverlay.classList.add("show");
        mtbHamburger.textContent = "\u2715";
      }
    });
    sidebarOverlay.addEventListener("click", function () {
      sidebar.classList.remove("open");
      sidebarOverlay.classList.remove("show");
      mtbHamburger.textContent = "\u2630";
    });
    navList.addEventListener("click", function (e) {
      if (e.target.closest(".nav-item") && window.innerWidth <= 900) {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("show");
        mtbHamburger.textContent = "\u2630";
      }
    });
  }
  // 同步进度到顶栏
  if (mtbProgress) {
    var origUpdateProgress = updateProgress;
    updateProgress = function() {
      origUpdateProgress();
      if (mtbProgress) mtbProgress.textContent = progressText.textContent;
    };
  }
  // 提交按钮
  if (mtbSubmitBtn) {
    mtbSubmitBtn.addEventListener("click", function () { onSubmit(); });
  }
  // 提交后隐藏交卷按钮
  var origSubmit = onSubmit;
  onSubmit = function() {
    origSubmit();
    if (mtbSubmitBtn) mtbSubmitBtn.classList.add("hidden");
  };
  var origReset = onReset;
  onReset = function() {
    origReset();
    if (mtbSubmitBtn) mtbSubmitBtn.classList.remove("hidden");
  };

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

/* ── localStorage 答案保存 ─────────────────────────── */
function saveAnswersToStorage() {
  if (gradingActive) return; // 批阅期间不保存
  if (!window.localStorage) return;

  var data = {};
  try {
    // 选择题
    var radios = container.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
    for (var i = 0; i < radios.length; i++) {
      var qid = radios[i].getAttribute("data-qid");
      if (!data[qid]) data[qid] = "";
      data[qid] += radios[i].value;
    }
    // 填空题
    var fills = container.querySelectorAll(".fill-inline");
    for (var j = 0; j < fills.length; j++) {
      var fqid = fills[j].getAttribute("data-qid");
      var bidx = fills[j].getAttribute("data-blank-index");
      var key = fqid + "_blank" + bidx;
      data[key] = fills[j].value;
    }
    // 简答题
    var essays = container.querySelectorAll(".essay-textarea");
    for (var k = 0; k < essays.length; k++) {
      var eqid = essays[k].getAttribute("data-qid");
      if (!data[eqid]) data[eqid] = essays[k].value;
    }
    // 书签
    if (typeof bookmarkedSet !== "undefined") {
      data["__bookmarks__"] = JSON.stringify(Array.from(bookmarkedSet));
    }

    localStorage.setItem(_examId, JSON.stringify(data));
  } catch (e) { /* quota exceeded, ignore */ }
}

function restoreAnswersFromStorage() {
  if (!window.localStorage) return;
  try {
    var raw = localStorage.getItem(_examId);
    if (!raw) return;
    var data = JSON.parse(raw);

    // 恢复书签
    if (data["__bookmarks__"] && typeof toggleBookmark === "function") {
      var bmArray = JSON.parse(data["__bookmarks__"]);
      for (var b = 0; b < bmArray.length; b++) {
        toggleBookmark(bmArray[b], true);
      }
    }

    for (var key in data) {
      if (key === "__bookmarks__") continue;
      if (key.indexOf("_blank") !== -1) {
        // 填空题
        var parts = key.split("_blank");
        var qid = parts[0];
        var idx = parseInt(parts[1]);
        var inp = container.querySelector('.fill-inline[data-qid="' + qid + '"][data-blank-index="' + idx + '"]');
        if (inp) inp.value = data[key];
      } else {
        // 判断 key 是选择题还是简答题
        var qid = key;
        var q = findExamData(qid);
        if (!q) continue;
        if (q.qtype === QT.SINGLE || q.qtype === QT.MULTIPLE) {
          var answer = data[key];
          for (var ci = 0; ci < answer.length; ci++) {
            var input = container.querySelector('input[value="' + answer[ci] + '"][data-qid="' + qid + '"]');
            if (input) input.checked = true;
          }
        } else if (q.qtype === QT.ESSAY) {
          var ta = container.querySelector('.essay-textarea[data-qid="' + qid + '"]');
          if (ta) ta.value = data[key];
        }
      }
    }
    updateProgress();
  } catch (e) { /* ignore corrupt data */ }
}

function clearSavedAnswers() {
  if (!window.localStorage) return;
  try { localStorage.removeItem(_examId); } catch(e) {}
}

/* ── 键盘快捷键 ────────────────────────────────────── */
var _currentFocusQid = null;

function onKeyDown(e) {
  // 在 input/textarea 中不拦截（Tab/数字键除外部分）
  var tag = (e.target.tagName || "").toLowerCase();
  var isInput = (tag === "input" || tag === "textarea");
  var isEssay = e.target.classList.contains("essay-textarea");

  // 判断题：数字 1-2 映射 A-B
  // 选择/多选：数字 1-4 切换选项勾选
  if (!isInput || e.target.type === "radio" || e.target.type === "checkbox") {
    if (e.key >= "1" && e.key <= "4") {
      var idx = parseInt(e.key) - 1;
      var qid = getFocusedQid();
      if (!qid) return;
      var q = findExamData(qid);
      if (!q) return;
      if (q.qtype === QT.SINGLE || q.qtype === QT.MULTIPLE || q.qtype === QT.JUDGE) {
        var qtype = q.qtype;
        var isMulti = qtype === QT.MULTIPLE;
        var letter = String.fromCharCode(65 + idx); // 1→A, 2→B...
        if (isMulti) {
          var cb = container.querySelector('input[type="checkbox"][data-qid="' + qid + '"][value="' + letter + '"]');
          if (cb) cb.checked = !cb.checked;
        } else {
          var rb = container.querySelector('input[type="radio"][data-qid="' + qid + '"][value="' + letter + '"]');
          if (rb) rb.checked = true;
        }
        updateProgress();
        saveAnswersToStorage();
        return;
      }
    }
  }

  // Enter 或 Ctrl+Enter：提交
  if ((e.key === "Enter" && !isEssay) || (e.key === "Enter" && e.ctrlKey)) {
    e.preventDefault();
    if (!submitBtn.disabled && !gradingActive) onSubmit();
    return;
  }

  // Tab：跳下一题（shift+Tab 跳上一题）
  if (e.key === "Tab" && !e.ctrlKey) {
    var qid = getFocusedQid();
    if (qid) {
      e.preventDefault();
      var direction = e.shiftKey ? -1 : 1;
      navigateQuestion(qid, direction);
    }
  }
}

function getFocusedQid() {
  if (_currentFocusQid) return _currentFocusQid;
  // 自动检测当前视口中心题目
  var best = null;
  var bestTop = Infinity;
  for (var i = 0; i < EXAM_DATA.length; i++) {
    var card = container.querySelector('.question-card[data-qid="' + EXAM_DATA[i].id + '"]');
    if (!card) continue;
    var rect = card.getBoundingClientRect();
    var dist = Math.abs(rect.top - window.innerHeight / 3);
    if (dist < bestTop) { bestTop = dist; best = EXAM_DATA[i].id; }
  }
  _currentFocusQid = best;
  return best;
}

function navigateQuestion(fromQid, direction) {
  var idx = -1;
  for (var i = 0; i < EXAM_DATA.length; i++) {
    if (EXAM_DATA[i].id == fromQid) { idx = i; break; }
  }
  if (idx < 0) return;
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= EXAM_DATA.length) return;
  _currentFocusQid = EXAM_DATA[newIdx].id;

  var card = container.querySelector('.question-card[data-qid="' + _currentFocusQid + '"]');
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    // 聚焦第一个输入元素
    setTimeout(function () {
      var firstInput = card.querySelector('input[type="radio"], input[type="checkbox"], .fill-inline, .essay-textarea');
      if (firstInput) firstInput.focus();
    }, 400);
  }
}
