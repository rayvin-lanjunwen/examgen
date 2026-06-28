/* ── 闯关模式状态 ──────────────────────────────────── */
var challengeCurrent = 1;        // 当前题号 (1-based)
var challengeJudged = {};        // { qid: bool } 是否已判分
var challengeResults = {};       // { qid: { correct, userAns } }
var challengeEssayAnswers = {};  // { qid: str } 简答题答案（只显示参考，不判分）
var challengeEnded = false;
var retryBtn = document.getElementById("retry-btn");
var endBtn = document.getElementById("end-btn");

/* ── 覆盖 renderQuestions：每次只渲染当前题 ─────────── */
var _nativeRender = renderQuestions;
renderQuestions = function () {
  container.innerHTML = "";
  // 清空答案反馈区
  var fb = document.getElementById("challenge-feedback");
  var exp = document.getElementById("challenge-explanation");
  var ref = document.getElementById("challenge-reference");
  if (fb) { fb.innerHTML = ""; fb.className = "challenge-feedback"; }
  if (exp) { exp.innerHTML = ""; exp.style.display = "none"; }
  if (ref) { ref.innerHTML = ""; ref.style.display = "none"; }

  var q = findExamData(challengeCurrent);
  if (!q) {
    container.innerHTML = '<div class="challenge-feedback show wrong">题目数据异常</div>';
    return;
  }
  var card = buildQuestionCard(q);
  container.appendChild(card);

  // 如果本题已判过，恢复反馈状态
  if (challengeJudged[q.id]) {
    showChallengeFeedback(q, challengeResults[q.id]);
    // 恢复解析
    if (q.explanation && exp) {
      exp.innerHTML = '<span class="exp-icon">&#128161;</span> 解析' + mdToHTML(q.explanation);
      exp.className = "explanation show";
    }
    // 恢复参考答案（简答）
    if (q.answer && q.qtype === "essay" && ref) {
      ref.innerHTML = '<span class="ref-icon">&#128221;</span> 参考答案' + mdToHTML(q.answer);
      ref.className = "essay-reference show";
    }
  }

  if (typeof renderMathInElement !== "undefined") {
    renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$",  right: "$",  display: false }
      ]
    });
    var fbd = document.getElementById("challenge-feedback");
    if (fbd) renderMathInElement(fbd, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }] });
  }
  highlightCurrentByQid(challengeCurrent);
  updateChallengeProgress();
  updateChallengeNavButtons();
};

/* ── 覆盖 updateProgress：基于判分状态 ──────────────── */
var _nativeUpdateProgress = updateProgress;
updateProgress = function () {
  var total = EXAM_DATA.length;
  var judged = Object.keys(challengeJudged).length;
  progressFill.style.width = (total > 0 ? Math.round(judged / total * 100) : 0) + "%";
  progressText.textContent = judged + "/" + total;

  // 同步导航栏 done 标记
  for (var i = 0; i < EXAM_DATA.length; i++) {
    var qid2 = EXAM_DATA[i].id;
    var navDone = navList.querySelector('.nav-done[data-qid="' + qid2 + '"]');
    if (navDone) {
      if (challengeJudged[qid2]) { navDone.classList.add("done"); }
      else { navDone.classList.remove("done"); }
    }
  }

  // 同步手机端进度
  var mtbProgress = document.getElementById("mtbProgress");
  if (mtbProgress) mtbProgress.textContent = progressText.textContent;

  if (typeof fillSectionProgress === "function") fillSectionProgress();
};

/* ── 侧栏高亮当前题 ────────────────────────────────── */
function highlightCurrentByQid(qid) {
  var items = navList.querySelectorAll(".nav-item");
  for (var j = 0; j < items.length; j++) { items[j].classList.remove("active"); }
  var active = navList.querySelector('.nav-item[data-qid="' + qid + '"]');
  if (active) active.classList.add("active");
}

/* ── 更新闯关进度条 ────────────────────────────────── */
function updateChallengeProgress() {
  var total = EXAM_DATA.length;
  var judged = Object.keys(challengeJudged).length;
  var pct = total > 0 ? Math.round(judged / total * 100) : 0;
  var fill = document.getElementById("challengeProgressFill");
  var label = document.getElementById("challengeProgressLabel");
  if (fill) fill.style.width = pct + "%";
  if (label) label.textContent = judged + " / " + total;
}

/* ── 更新上下题按钮状态 ─────────────────────────────── */
function updateChallengeNavButtons() {
  var prevBtn = document.getElementById("challenge-prev-btn");
  var nextBtn = document.getElementById("challenge-next-btn");
  var curLabel = document.getElementById("challengeCurrent");
  if (prevBtn) prevBtn.disabled = challengeCurrent <= 1;
  if (nextBtn) nextBtn.disabled = challengeCurrent >= EXAM_DATA.length;
  if (curLabel) curLabel.textContent = "第 " + challengeCurrent + " 题";
}

/* ── 导航到指定题 ──────────────────────────────────── */
function challengeGoTo(qid) {
  if (challengeEnded) return;
  challengeCurrent = qid;
  renderQuestions();

  // 如果已判过 → 隐藏提交按钮，显示重做按钮
  var q = findExamData(qid);
  submitBtn.classList.toggle("hidden", !!challengeJudged[qid]);
  retryBtn.classList.toggle("hidden", !challengeJudged[qid] || (q && q.qtype === QT.ESSAY));

  // 滚动到卡片
  var card = container.querySelector('.question-card[data-qid="' + qid + '"]');
  if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });

  // 填充本题卡片的书签星标
  var bm = container.querySelector(".question-bookmark");
  if (bm && typeof starSvg === "function") {
    bm.innerHTML = starSvg(bookmarkedSet.has(String(qid)));
    if (bookmarkedSet.has(String(qid))) bm.classList.add("active");
    else bm.classList.remove("active");
  }

  saveAnswersToStorage();
}

/* ── 上一题/下一题 ──────────────────────────────────── */
function challengePrev() {
  if (challengeCurrent > 1) challengeGoTo(challengeCurrent - 1);
}
function challengeNext() {
  if (challengeCurrent < EXAM_DATA.length) challengeGoTo(challengeCurrent + 1);
}

/* ── 提交并判分当前题 ────────────────────────────────── */
function challengeSubmit() {
  if (challengeEnded) return;
  var q = findExamData(challengeCurrent);
  if (!q) return;

  var userAns = collectCurrentAnswer(q);
  if (!userAns && q.qtype !== QT.ESSAY) {
    if (!confirm("你还没有作答，确定提交吗？")) return;
  }

  if (q.qtype === QT.ESSAY) {
    // 简答题：显示参考答案，不判分
    challengeEssayAnswers[q.id] = userAns || "";
    challengeJudged[q.id] = true;
    challengeResults[q.id] = { correct: null, userAns: userAns || "" };
    disableCurrentInputs();
    // 移动解析和参考答案到固定区域
    _moveCardExtrasToAnswerZone(q);
    updateChallengeAfterJudge(q);
  } else {
    var correct = isCorrect(q, userAns);
    challengeJudged[q.id] = true;
    challengeResults[q.id] = { correct: correct, userAns: userAns || "" };
    highlightResult(q, userAns, correct);
    disableCurrentInputs();
    _moveCardExtrasToAnswerZone(q);
    updateChallengeAfterJudge(q);
  }

  updateChallengeNavResult(q.id);
  saveAnswersToStorage();
}

/* ── 将题卡中的解析/参考答案移动到答案反馈区 ───────── */
function _moveCardExtrasToAnswerZone(q) {
  var card = container.querySelector('.question-card[data-qid="' + q.id + '"]');
  if (!card) return;

  // 移动解析
  var cardExp = card.querySelector(".explanation");
  var expZone = document.getElementById("challenge-explanation");
  if (cardExp && expZone) {
    expZone.innerHTML = cardExp.innerHTML;
    expZone.className = "explanation show";
    cardExp.remove();
  }

  // 移动参考答案（简答）
  var cardRef = card.querySelector(".essay-reference");
  var refZone = document.getElementById("challenge-reference");
  if (cardRef && refZone) {
    refZone.innerHTML = cardRef.innerHTML;
    refZone.className = "essay-reference show";
    cardRef.remove();
  }

  // 移除 answer-display（由 challenge-feedback 替代）
  var ad = card.querySelector(".answer-display");
  if (ad) ad.remove();
}

/* ── 判分后的 UI 更新 ────────────────────────────────── */
function updateChallengeAfterJudge(q) {
  submitBtn.classList.add("hidden");
  if (q.qtype !== QT.ESSAY) {
    retryBtn.classList.remove("hidden");
  } else {
    retryBtn.classList.add("hidden");
  }
  updateChallengeProgress();
  updateProgress();

  // 更新实时总分显示
  var scored = computeChallengeScore();
  var el = document.getElementById("challenge-score-live");
  if (el) el.textContent = scored.user + " / " + scored.max + " 分";

  // 如果全部完成，自动显示成绩
  if (Object.keys(challengeJudged).length >= EXAM_DATA.length) {
    setTimeout(function () { challengeEnd(); }, 800);
  }
}

/* ── 收集当前题答案 ──────────────────────────────────── */
function collectCurrentAnswer(q) {
  if (q.qtype === QT.SINGLE || q.qtype === QT.MULTIPLE || q.qtype === QT.JUDGE) {
    var checked = container.querySelectorAll('input[name="q_' + q.id + '"]:checked');
    var ans = "";
    for (var i = 0; i < checked.length; i++) { ans += checked[i].value; }
    return ans;
  }
  if (q.qtype === QT.FILL) {
    var fills = container.querySelectorAll('.fill-inline[data-qid="' + q.id + '"]');
    var parts = [];
    for (var j = 0; j < fills.length; j++) {
      parts.push(fills[j].value.trim());
    }
    return parts.join("|");
  }
  if (q.qtype === QT.ESSAY) {
    var ta = container.querySelector('.essay-textarea[data-qid="' + q.id + '"]');
    return ta ? ta.value.trim() : "";
  }
  return "";
}

/* ── 禁用当前题输入 ──────────────────────────────────── */
function disableCurrentInputs() {
  var inps = container.querySelectorAll("input, textarea");
  for (var i = 0; i < inps.length; i++) { inps[i].disabled = true; }
}

/* ── 显示判分反馈 ─────────────────────────────────── */
function showChallengeFeedback(q, result) {
  var fb = document.getElementById("challenge-feedback");
  if (!fb) return;
  fb.innerHTML = "";
  fb.className = "challenge-feedback show";

  if (q.qtype === QT.ESSAY || result.correct === null) {
    fb.classList.add("wrong");
    fb.innerHTML = '<span class="challenge-feedback-icon">&#128221;</span> 简答题不自动判分，请自行对照参考答案';
    return;
  }

  if (result.correct) {
    fb.classList.add("correct");
    fb.innerHTML = '<span class="challenge-feedback-icon">&#10003;</span> 回答正确！标准答案：<strong>' + escapeHTML(q.answer) + '</strong>';
  } else {
    fb.classList.add("wrong");
    fb.innerHTML = '<span class="challenge-feedback-icon">&#10007;</span> 回答错误。正确答案：<strong>' + escapeHTML(q.answer) + '</strong>';
  }

  // 确保解析区可见
  var expZone = document.getElementById("challenge-explanation");
  if (expZone && q.explanation) {
    expZone.innerHTML = '<span class="exp-icon">&#128161;</span> 解析' + mdToHTML(q.explanation);
    expZone.className = "explanation show";
  }

  if (typeof renderMathInElement !== "undefined") {
    renderMathInElement(fb, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$",  right: "$",  display: false }
      ]
    });
  }
}

/* ── 更新侧栏单题对错标记 ────────────────────────────── */
function updateChallengeNavResult(qid) {
  var r = challengeResults[qid];
  var navItem = navList.querySelector('.nav-item[data-qid="' + qid + '"]');
  if (!navItem) return;
  navItem.classList.remove("nav-correct", "nav-wrong", "nav-essay");
  var navDone = navItem.querySelector(".nav-done");
  if (!navDone) return;
  navDone.classList.add("done");

  if (r.correct === true) {
    navItem.classList.add("nav-correct");
    navDone.textContent = "✓";
  } else if (r.correct === false) {
    navItem.classList.add("nav-wrong");
    navDone.textContent = "✗";
  } else {
    navItem.classList.add("nav-essay");
    navDone.textContent = "?";
  }
}

/* ── 重做当前题 ──────────────────────────────────────── */
function challengeRetry() {
  var qid = challengeCurrent;
  delete challengeJudged[qid];
  delete challengeResults[qid];
  delete challengeEssayAnswers[qid];

  // 重新渲染（恢复可编辑状态）
  challengeGoTo(qid);

  // 清除侧栏对错
  var navItem = navList.querySelector('.nav-item[data-qid="' + qid + '"]');
  if (navItem) {
    navItem.classList.remove("nav-correct", "nav-wrong", "nav-essay");
    var navDone = navItem.querySelector(".nav-done");
    if (navDone) { navDone.classList.remove("done"); navDone.textContent = "✓"; }
  }

  updateChallengeProgress();
  updateProgress();

  var el = document.getElementById("challenge-score-live");
  if (el) {
    var scored = computeChallengeScore();
    el.textContent = scored.user + " / " + scored.max + " 分";
  }
}

/* ── 结束闯关 ──────────────────────────────────────────── */
function challengeEnd() {
  if (challengeEnded) return;
  challengeEnded = true;

  // 停止计时
  if (typeof countdownTimer !== "undefined" && countdownTimer) clearInterval(countdownTimer);

  var scored = computeChallengeScore();
  var totalJudged = Object.keys(challengeJudged).length;
  var correctCount = 0;
  for (var qid in challengeResults) {
    if (challengeResults[qid].correct === true) correctCount++;
  }

  // 构建 examResults（兼容 showFinalScore）
  examResults = [];
  for (var i = 0; i < EXAM_DATA.length; i++) {
    var q = EXAM_DATA[i];
    var r = challengeResults[q.id];
    if (r) {
      examResults.push({
        id: q.id,
        correct: r.correct,
        score: q.score || 0,
        topic: q.topic,
        qtype: q.qtype
      });
    } else {
      examResults.push({
        id: q.id,
        correct: null,
        score: q.score || 0,
        topic: q.topic,
        qtype: q.qtype
      });
    }
  }

  showFinalScore(scored.user, scored.max, totalJudged, correctCount);

  // 禁用所有输入
  var allInps = container.querySelectorAll("input, textarea, button");
  submitBtn.classList.add("hidden");
  retryBtn.classList.add("hidden");
  endBtn.classList.add("hidden");
  var prevBtn = document.getElementById("challenge-prev-btn");
  var nextBtn = document.getElementById("challenge-next-btn");
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;

  // 隐藏手机端结束按钮
  var mtbEnd = document.getElementById("mtbEndBtn");
  if (mtbEnd) mtbEnd.classList.add("hidden");

  // 重新渲染当前题（保持可见）
  updateChallengeProgress();
  updateProgress();
  updateNavResults();

  clearSavedAnswers();
}

/* ── 计算当前得分 ──────────────────────────────────────── */
function computeChallengeScore() {
  var totalUser = 0;
  var totalMax = 0;
  for (var i = 0; i < EXAM_DATA.length; i++) {
    var q = EXAM_DATA[i];
    var maxS = q.score || 0;
    totalMax += maxS;
    var r = challengeResults[q.id];
    if (r && r.correct === true) {
      totalUser += maxS;
    }
  }
  return { user: totalUser, max: totalMax };
}

/* ── 覆盖 saveAnswersToStorage ────────────────────────── */
/* 07_init.js 被跳过，saveAnswersToStorage 不存在，直接定义 */
saveAnswersToStorage = function () {
  if (!window.localStorage) return;
  var data = {};
  try {
    // 当前可见的输入
    var radios = container.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
    for (var i = 0; i < radios.length; i++) {
      var qid = radios[i].getAttribute("data-qid");
      if (!data[qid]) data[qid] = "";
      data[qid] += radios[i].value;
    }
    var fills = container.querySelectorAll(".fill-inline");
    for (var j = 0; j < fills.length; j++) {
      var fqid = fills[j].getAttribute("data-qid");
      var bidx = fills[j].getAttribute("data-blank-index");
      var key = fqid + "_blank" + bidx;
      data[key] = fills[j].value;
    }
    var essays = container.querySelectorAll(".essay-textarea");
    for (var k = 0; k < essays.length; k++) {
      var eqid = essays[k].getAttribute("data-qid");
      if (!data[eqid]) data[eqid] = essays[k].value;
    }
    // 检查是否有已保存的答案
    var existing = {};
    try {
      var raw = localStorage.getItem(_examId);
      if (raw) existing = JSON.parse(raw);
    } catch (e) {}
    // 合并：保留已判题的答案
    for (var key in existing) {
      if (key === "__bookmarks__" || key === "__challenge__") continue;
      if (!(key in data)) data[key] = existing[key];
    }
    // 持久化挑战状态
    data["__challenge__"] = JSON.stringify({
      judged: challengeJudged,
      results: challengeResults,
      essays: challengeEssayAnswers,
      current: challengeCurrent
    });
    // 书签
    if (typeof bookmarkedSet !== "undefined") {
      data["__bookmarks__"] = JSON.stringify(Array.from(bookmarkedSet));
    }
    localStorage.setItem(_examId, JSON.stringify(data));
  } catch (e) {}
};

/* ── 恢复已保存状态 ────────────────────────────────────── */
function restoreChallengeState() {
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

    // 恢复挑战状态
    if (data["__challenge__"]) {
      var cs = JSON.parse(data["__challenge__"]);
      challengeJudged = cs.judged || {};
      challengeResults = cs.results || {};
      challengeEssayAnswers = cs.essays || {};
      if (cs.current) challengeCurrent = cs.current;
    }

    // 恢复输入答案（仅当前题，未判过的）
    for (var key in data) {
      if (key === "__bookmarks__" || key === "__challenge__") continue;
      if (key.indexOf("_blank") !== -1) {
        var parts = key.split("_blank");
        var qid = parts[0];
        if (challengeJudged[qid]) continue; // 已判不恢复
        var idx = parseInt(parts[1]);
        var inp = container.querySelector('.fill-inline[data-qid="' + qid + '"][data-blank-index="' + idx + '"]');
        if (inp) inp.value = data[key];
      } else {
        var qid = key;
        if (challengeJudged[qid]) continue;
        var q = findExamData(qid);
        if (!q) continue;
        if (q.qtype === QT.SINGLE || q.qtype === QT.MULTIPLE || q.qtype === QT.JUDGE) {
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
    updateChallengeProgress();
    updateChallengeNavButtons();
    updateChallengeScoreLive();
  } catch (e) {}
}

function updateChallengeScoreLive() {
  var el = document.getElementById("challenge-score-live");
  if (el) {
    var scored = computeChallengeScore();
    el.textContent = scored.user + " / " + scored.max + " 分";
  }
}

/* ── 覆盖 clearSavedAnswers ──────────────────────────── */
clearSavedAnswers = function () {
  if (!window.localStorage) return;
  try { localStorage.removeItem(_examId); } catch (e) {}
};

/* ═══════════════════════════════════════════════════════
   工具函数（从 08_grading.js 移植，因该文件被跳过）
   ═══════════════════════════════════════════════════════ */
function findExamData(qid) {
  for (var i = 0; i < EXAM_DATA.length; i++) {
    if (EXAM_DATA[i].id == qid) return EXAM_DATA[i];
  }
  return null;
}

function reRenderMath(el) {
  if (typeof renderMathInElement === "undefined") return;
  var target = el || container;
  renderMathInElement(target, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$",  right: "$",  display: false }
    ]
  });
}

/* ═══════════════════════════════════════════════════════
   初始化
   ═══════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", function () {
  _examId = "examgen_" + (EXAM_META.title || "challenge").replace(/[^a-zA-Z0-9]/g, "_");

  buildNavSidebar(EXAM_DATA);
  renderQuestions(EXAM_DATA);
  initBookmarks();

  // 恢复状态
  restoreChallengeState();
  // 重新渲染（确保恢复的状态可见）
  renderQuestions(EXAM_DATA);
  // 渲染后填充卡片上的书签星标
  if (typeof initBookmarks === "function") { initBookmarks(); }

  // 按钮绑定
  submitBtn.addEventListener("click", challengeSubmit);
  retryBtn.addEventListener("click", challengeRetry);
  endBtn.addEventListener("click", challengeEnd);
  if (resetBtn) resetBtn.addEventListener("click", onReset);

  var prevBtn = document.getElementById("challenge-prev-btn");
  var nextBtn = document.getElementById("challenge-next-btn");
  if (prevBtn) prevBtn.addEventListener("click", challengePrev);
  if (nextBtn) nextBtn.addEventListener("click", challengeNext);

  // 计时
  if (EXAM_META && EXAM_META.time) {
    startCountdown(EXAM_META.time * 60);
  } else {
    if (timerBarOuter) timerBarOuter.style.display = "none";
    timerBar.style.display = "none";
  }

  // 全局输入监听（更新进度）
  container.addEventListener("change", function () { updateProgress(); saveAnswersToStorage(); });
  container.addEventListener("input", function () { updateProgress(); saveAnswersToStorage(); });

  // 侧栏点击跳转
  navList.addEventListener("click", function (e) {
    var item = e.target.closest(".nav-item");
    if (!item) return;
    var qid = parseInt(item.getAttribute("data-qid"));
    if (qid) challengeGoTo(qid);

    // 手机端关闭侧栏
    var sidebar = document.getElementById("sidebar");
    var sidebarOverlay = document.getElementById("sidebarOverlay");
    var mtbHamburger = document.getElementById("mtbHamburgerBtn");
    if (window.innerWidth <= 900 && sidebar && mtbHamburger) {
      sidebar.classList.remove("open");
      if (sidebarOverlay) sidebarOverlay.classList.remove("show");
      mtbHamburger.textContent = "\u2630";
    }
  });

  // 键盘快捷键：1-4 选选项
  document.addEventListener("keydown", function (e) {
    if (challengeEnded) return;
    var tag = (e.target.tagName || "").toLowerCase();
    var isInput = (tag === "input" || tag === "textarea");
    var isEssay = e.target.classList.contains("essay-textarea");

    // 数字键选择
    if (!isInput || e.target.type === "radio" || e.target.type === "checkbox") {
      if (e.key >= "1" && e.key <= "4") {
        var idx = parseInt(e.key) - 1;
        var q = findExamData(challengeCurrent);
        if (!q || challengeJudged[q.id]) return;
        if (q.qtype === QT.SINGLE || q.qtype === QT.MULTIPLE || q.qtype === QT.JUDGE) {
          var isMulti = q.qtype === QT.MULTIPLE;
          var letter = String.fromCharCode(65 + idx);
          if (isMulti) {
            var cb = container.querySelector('input[type="checkbox"][data-qid="' + q.id + '"][value="' + letter + '"]');
            if (cb) cb.checked = !cb.checked;
          } else {
            var rb = container.querySelector('input[type="radio"][data-qid="' + q.id + '"][value="' + letter + '"]');
            if (rb) rb.checked = true;
          }
          updateProgress();
          saveAnswersToStorage();
          return;
        }
      }
    }

    // Enter：提交当前题
    if ((e.key === "Enter" && !isEssay) || (e.key === "Enter" && e.ctrlKey)) {
      e.preventDefault();
      if (!challengeJudged[challengeCurrent] && !submitBtn.disabled) challengeSubmit();
      return;
    }

    // 左右箭头：切换题目
    if (e.key === "ArrowLeft" && !isInput) {
      e.preventDefault();
      challengePrev();
      return;
    }
    if (e.key === "ArrowRight" && !isInput) {
      e.preventDefault();
      challengeNext();
      return;
    }
  });

  // 侧边栏折叠/展开
  var collapseBtn = document.getElementById("sidebarCollapseBtn");
  var sidebarEl = document.getElementById("sidebar");
  var mainContent = document.querySelector(".main-content");
  var expandBtn = document.getElementById("sidebarExpandBtn");
  if (collapseBtn && sidebarEl) {
    collapseBtn.addEventListener("click", function () {
      sidebarEl.classList.toggle("collapsed");
      if (sidebarEl.classList.contains("collapsed")) {
        collapseBtn.innerHTML = "&#9654;";
        mainContent.style.marginLeft = "0";
        if (expandBtn) expandBtn.classList.remove("hidden");
      } else {
        collapseBtn.innerHTML = "&#9664;";
        mainContent.style.marginLeft = "";
        if (expandBtn) expandBtn.classList.add("hidden");
      }
    });
  }
  if (expandBtn) {
    expandBtn.addEventListener("click", function () {
      sidebarEl.classList.remove("collapsed");
      collapseBtn.innerHTML = "&#9664;";
      mainContent.style.marginLeft = "";
      expandBtn.classList.add("hidden");
    });
  }

  // 手机端
  var mtbHamburger = document.getElementById("mtbHamburgerBtn");
  var mtbEndBtn = document.getElementById("mtbEndBtn");
  var sidebarOverlay = document.getElementById("sidebarOverlay");
  if (mtbHamburger && sidebarEl) {
    mtbHamburger.addEventListener("click", function () {
      var isOpen = sidebarEl.classList.contains("open");
      if (isOpen) {
        sidebarEl.classList.remove("open");
        sidebarOverlay.classList.remove("show");
        mtbHamburger.textContent = "\u2630";
      } else {
        sidebarEl.classList.remove("collapsed");
        sidebarEl.classList.add("open");
        sidebarOverlay.classList.add("show");
        mtbHamburger.textContent = "\u2715";
      }
    });
    sidebarOverlay.addEventListener("click", function () {
      sidebarEl.classList.remove("open");
      sidebarOverlay.classList.remove("show");
      mtbHamburger.textContent = "\u2630";
    });
  }
  if (mtbEndBtn) {
    mtbEndBtn.addEventListener("click", challengeEnd);
  }

  // 触摸手势
  var touchStartX = 0, touchStartY = 0;
  container.addEventListener("touchstart", function (e) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });
  container.addEventListener("touchend", function (e) {
    if (!touchStartX) return;
    var dx = (e.changedTouches[0].clientX - touchStartX);
    var dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    touchStartX = 0;
    if (Math.abs(dx) < 60 || dy > Math.abs(dx) * 0.7) return;
    if (dx < 0) challengeNext();
    else challengePrev();
  });

  // CDN 检测
  setTimeout(function () {
    var warnings = [];
    if (typeof renderMathInElement === "undefined") warnings.push("数学公式渲染（KaTeX）");
    if (typeof marked === "undefined") warnings.push("Markdown 渲染（marked）");
    if (warnings.length > 0) {
      var banner = document.createElement("div");
      banner.className = "cdn-fallback-banner";
      banner.innerHTML = "<strong>离线提示</strong> 当前处于离线状态，以下功能不可用：" + warnings.join("、") + "。公式/解析将以纯文本显示。";
      var main = document.querySelector(".main-content");
      if (main) main.insertBefore(banner, main.firstChild);
    }
  }, 3000);
});

/* ── 重做按钮的 reset 逻辑 ───────────────────────────── */
/* ── 覆盖 onSubmit：倒计时到期时调用挑战结束 ────────────── */
/* 07_init.js 被跳过，onSubmit 不存在，直接定义 */
onSubmit = function () {
  if (!challengeEnded) challengeEnd();
};

/* ── 完全重置 ─────────────────────────────────────────── */
function onReset() {
  // 闯关模式下重置全部
  challengeJudged = {};
  challengeResults = {};
  challengeEssayAnswers = {};
  challengeCurrent = 1;
  challengeEnded = false;

  renderQuestions(EXAM_DATA);
  submitBtn.classList.remove("hidden");
  retryBtn.classList.add("hidden");
  endBtn.classList.remove("hidden");
  scoreArea.classList.add("hidden");
  passStatus.textContent = "";
  passStatus.className = "";

  var navItems = navList.querySelectorAll(".nav-item.nav-correct, .nav-item.nav-wrong, .nav-item.nav-essay");
  for (var na = 0; na < navItems.length; na++) {
    navItems[na].classList.remove("nav-correct", "nav-wrong", "nav-essay");
    var nd = navItems[na].querySelector(".nav-done");
    if (nd) { nd.classList.remove("done"); nd.textContent = "✓"; }
  }
  navResult.classList.add("hidden");

  // 重置书签UI
  var bookmarks = document.querySelectorAll(".nav-bookmark");
  for (var bi = 0; bi < bookmarks.length; bi++) {
    bookmarks[bi].innerHTML = starSvg(false);
    bookmarks[bi].classList.remove("active");
  }

  updateProgress();
  updateChallengeProgress();
  updateChallengeNavButtons();

  if (EXAM_META && EXAM_META.time) {
    startCountdown(EXAM_META.time * 60);
  }
  clearSavedAnswers();

  var el = document.getElementById("challenge-score-live");
  if (el) el.textContent = "0 / " + (EXAM_META.total_score || 0) + " 分";
}
