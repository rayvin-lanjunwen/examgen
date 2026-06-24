/* ── 批阅系统 ─────────────────────────────────────────── */
var gradingScores = {};       // { qid: score }
var gradingMaxScores = {};    // { qid: maxScore }
var gradingCurrentQid = null; // 当前聚焦的简答题 ID
var gradingActive = false;
var gradingEssayOrder = [];   // 简答题 id 列表（按顺序）

/* ── 判断是否有简答题 ────────────────────────────────── */
function hasEssayQuestions() {
  for (var i = 0; i < examResults.length; i++) {
    if (examResults[i].correct === null) return true;
  }
  return false;
}

/* ── 进入批阅模式 ────────────────────────────────────── */
function enterGradingMode() {
  gradingActive = true;
  gradingScores = {};
  gradingMaxScores = {};
  gradingEssayOrder = [];

  // 收集简答题信息
  for (var i = 0; i < examResults.length; i++) {
    var r = examResults[i];
    if (r.correct !== null) continue;
    // 关键词预判分
    var q = findExamData(r.id);
    var userAns = "";
    var ta = container.querySelector('.essay-textarea[data-qid="' + r.id + '"]');
    if (ta) userAns = ta.value;
    var kwResult = scoreEssayByKeywords(q, userAns);
    gradingScores[r.id] = kwResult.score;
    gradingMaxScores[r.id] = r.score || q.score || 5;
    if (kwResult.keywords.length > 0) {
      r._kwResult = kwResult;
    }
    gradingEssayOrder.push(r.id);
  }

  // 先让所有解析和参考答案可见并渲染公式
  var exps = container.querySelectorAll(".explanation");
  for (var e = 0; e < exps.length; e++) { exps[e].classList.add("show"); }
  var refs = container.querySelectorAll(".essay-reference");
  for (var r2 = 0; r2 < refs.length; r2++) { refs[r2].classList.add("show"); }
  reRenderMath();

  // 禁用所有独立文本输入（简答题文本框）
  var tas = container.querySelectorAll(".essay-textarea");
  for (var t = 0; t < tas.length; t++) { tas[t].disabled = true; }

  // 显示面板
  if (gradingBar) gradingBar.classList.remove("hidden");
  if (window.innerWidth <= 900) {
    // 手机端：显示底部 sheet，隐藏左右悬浮面板
    var sheet = document.getElementById("gradingSheet");
    if (sheet) {
      sheet.classList.remove("hidden");
      setTimeout(function () { sheet.classList.add("open"); }, 50);
    }
  } else {
    if (gradingLeftPanel) gradingLeftPanel.classList.remove("hidden");
    if (gradingRightPanel) gradingRightPanel.classList.remove("hidden");
  }
  scoreArea.classList.remove("hidden");
  resetBtn.classList.add("hidden");

  // 进入批阅时隐藏未答题提示
  if (navUnanswered) navUnanswered.classList.add("hidden");

  // 手机端：交卷按钮改为完成批阅按钮
  var mtbSubmitBtn = document.getElementById("mtbSubmitBtn");
  if (mtbSubmitBtn) {
    mtbSubmitBtn.textContent = "完成批阅";
    mtbSubmitBtn.classList.remove("hidden");
    mtbSubmitBtn.removeAttribute("data-submit");
    mtbSubmitBtn.setAttribute("data-grading", "1");
    // 重新绑定
    var newBtn = mtbSubmitBtn.cloneNode(true);
    mtbSubmitBtn.parentNode.replaceChild(newBtn, mtbSubmitBtn);
    newBtn.addEventListener("click", function () { onGradingDone(); });
  }

  // 构建右面板的快捷分值按钮
  buildRightPanelButtons();

  // 手机端底部 Sheet 构建
  buildGradingSheetButtons();

  // 绑定上一题/下一题按钮
  var prevBtn = document.getElementById("grpPrevBtn");
  var nextBtn = document.getElementById("grpNextBtn");
  if (prevBtn) {
    prevBtn.addEventListener("click", function () { navigateGradingQuestion(-1); });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", function () { navigateGradingQuestion(1); });
  }
  // 底部 sheet 翻题
  var gsPrev = document.getElementById("gsPrevBtn");
  var gsNext = document.getElementById("gsNextBtn");
  if (gsPrev) gsPrev.addEventListener("click", function () { navigateGradingQuestion(-1); });
  if (gsNext) gsNext.addEventListener("click", function () { navigateGradingQuestion(1); });

  // 默认聚焦第一道简答题
  switchGradingQuestion(gradingEssayOrder[0]);

  // 构建左面板简答题列表
  buildLeftPanelEssayList();

  computeRealtimeScore();

  // 滚动到第一道简答题
  var firstCard = container.querySelector('.question-card[data-qid="' + gradingEssayOrder[0] + '"]');
  if (firstCard) firstCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ── 构建手机端底部 Sheet 分值按钮 ───────────────── */
function buildGradingSheetButtons() {
  var gsButtons = document.getElementById("gsButtons");
  if (!gsButtons) return;
  var globalMax = 0;
  for (var i = 0; i < gradingEssayOrder.length; i++) {
    var m = gradingMaxScores[gradingEssayOrder[i]] || 5;
    if (m > globalMax) globalMax = m;
  }
  var html = "";
  for (var s = 0; s <= globalMax; s++) {
    var label = s === globalMax ? s + "(满)" : (s === 0 ? "0" : s);
    html += '<button class="grading-score-btn" data-score="' + s + '">' + label + '</button>';
  }
  gsButtons.innerHTML = html;

  gsButtons.querySelectorAll(".grading-score-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var score = parseInt(this.getAttribute("data-score"));
      var qid = gradingCurrentQid;
      if (!qid) return;
      var max = gradingMaxScores[qid] || 5;
      if (score > max) score = max;
      setGradingScoreUI(qid, score);
    });
  });
}

/* ── 构建右面板的快捷分值按钮 ────────────────────────── */
function buildRightPanelButtons() {
  var grpButtons = document.getElementById("grpButtons");
  if (!grpButtons) return;
  // 取所有简答题的最大分值
  var globalMax = 0;
  for (var i = 0; i < gradingEssayOrder.length; i++) {
    var m = gradingMaxScores[gradingEssayOrder[i]] || 5;
    if (m > globalMax) globalMax = m;
  }
  var html = "";
  for (var s = 0; s <= globalMax; s++) {
    var label = s === globalMax ? s + "(满)" : (s === 0 ? "0" : s);
    html += '<button class="grading-score-btn" data-score="' + s + '">' + label + '</button>';
  }
  grpButtons.innerHTML = html;

  // 绑定点击
  grpButtons.querySelectorAll(".grading-score-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var score = parseInt(this.getAttribute("data-score"));
      var qid = gradingCurrentQid;
      if (!qid) return;
      var max = gradingMaxScores[qid] || 5;
      if (score > max) score = max;
      setGradingScoreUI(qid, score);
    });
  });

  // 绑定手动输入
  var inp = document.getElementById("grpInput");
  if (inp) {
    inp.addEventListener("input", function () {
      var qid = gradingCurrentQid;
      if (!qid) return;
      var max = gradingMaxScores[qid] || 5;
      var score = parseInt(inp.value) || 0;
      if (score < 0) score = 0;
      if (score > max) score = max;
      setGradingScoreUI(qid, score);
    });
  }
}

/* ── 切换当前批阅题目 ────────────────────────────────── */
function switchGradingQuestion(qid) {
  gradingCurrentQid = qid;
  if (qid == null) return;

  var max = gradingMaxScores[qid] || 5;
  var cur = gradingScores[qid] || 0;

  // 更新右面板
  var grpQidEl = document.getElementById("grpQid");
  var grpScoreEl = document.getElementById("grpScore");
  var grpMaxEl = document.getElementById("grpMax");
  var grpInp = document.getElementById("grpInput");

  if (grpQidEl) grpQidEl.textContent = qid;
  if (grpScoreEl) grpScoreEl.textContent = cur;
  if (grpMaxEl) grpMaxEl.textContent = "/ " + max + " 分";
  if (grpInp) {
    grpInp.max = max;
    if (parseInt(grpInp.value) !== cur) grpInp.value = cur;
  }

  // 高亮对应按钮（仅高亮不超出 max 的）
  var grpButtons = document.getElementById("grpButtons");
  if (grpButtons) {
    grpButtons.querySelectorAll(".grading-score-btn").forEach(function (b) {
      b.classList.remove("selected");
      var bs = parseInt(b.getAttribute("data-score"));
      if (bs > max) {
        b.style.opacity = "0.3";
        b.style.pointerEvents = "none";
      } else {
        b.style.opacity = "";
        b.style.pointerEvents = "";
      }
    });
    var active = grpButtons.querySelector('.grading-score-btn[data-score="' + cur + '"]');
    if (active) active.classList.add("selected");
  }

  // 更新上一题/下一题按钮状态
  var idx = gradingEssayOrder.indexOf(qid);
  var prevBtn = document.getElementById("grpPrevBtn");
  var nextBtn = document.getElementById("grpNextBtn");
  if (prevBtn) prevBtn.disabled = (idx <= 0);
  if (nextBtn) nextBtn.disabled = (idx >= gradingEssayOrder.length - 1);
  // 底部 sheet
  var gsPrev = document.getElementById("gsPrevBtn");
  var gsNext = document.getElementById("gsNextBtn");
  if (gsPrev) gsPrev.disabled = (idx <= 0);
  if (gsNext) gsNext.disabled = (idx >= gradingEssayOrder.length - 1);

  // 更新底部 sheet 显示
  var gsQid = document.getElementById("gsQid");
  var gsScore = document.getElementById("gsScore");
  if (gsQid) gsQid.textContent = qid;
  if (gsScore) gsScore.textContent = cur + " / " + max;

  // 高亮 sheet 中的按钮
  var gsButtons = document.getElementById("gsButtons");
  if (gsButtons) {
    gsButtons.querySelectorAll(".grading-score-btn").forEach(function (b) {
      b.classList.remove("selected");
      var bs = parseInt(b.getAttribute("data-score"));
      if (bs > max) { b.style.opacity = "0.3"; b.style.pointerEvents = "none"; }
      else { b.style.opacity = ""; b.style.pointerEvents = ""; }
    });
    var active = gsButtons.querySelector('.grading-score-btn[data-score="' + cur + '"]');
    if (active) active.classList.add("selected");
  }

  // 更新左面板活跃项
  updateLeftPanelActive(qid);
}

/* ── 批阅上一题 / 下一题 ────────────────────────────── */
function navigateGradingQuestion(direction) {
  if (!gradingCurrentQid) return;
  var idx = gradingEssayOrder.indexOf(gradingCurrentQid);
  if (idx < 0) return;
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= gradingEssayOrder.length) return;
  focusEssayQuestion(gradingEssayOrder[newIdx]);
}

function setGradingScoreUI(qid, score) {
  gradingScores[qid] = score;

  // 同步右面板
  if (gradingCurrentQid === qid) {
    var grpScoreEl = document.getElementById("grpScore");
    var grpInp = document.getElementById("grpInput");
    if (grpScoreEl) grpScoreEl.textContent = score;
    if (grpInp && parseInt(grpInp.value) !== score) grpInp.value = score;

    // 同步底部 sheet
    var gsScore = document.getElementById("gsScore");
    if (gsScore) gsScore.textContent = score + " / " + (gradingMaxScores[qid] || 5);

    // 按钮
    var grpButtons = document.getElementById("grpButtons");
    if (grpButtons) {
      grpButtons.querySelectorAll(".grading-score-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      var active = grpButtons.querySelector('.grading-score-btn[data-score="' + score + '"]');
      if (active) active.classList.add("selected");
    }
    var gsButtons = document.getElementById("gsButtons");
    if (gsButtons) {
      gsButtons.querySelectorAll(".grading-score-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      var a2 = gsButtons.querySelector('.grading-score-btn[data-score="' + score + '"]');
      if (a2) a2.classList.add("selected");
    }
  }

  computeRealtimeScore();
}

/* ── 构建左面板简答题列表 ────────────────────────────── */
function buildLeftPanelEssayList() {
  var list = document.getElementById("glpEssayList");
  if (!list) return;
  var html = "";
  for (var i = 0; i < gradingEssayOrder.length; i++) {
    var qid = gradingEssayOrder[i];
    var max = gradingMaxScores[qid] || 5;
    html += '<div class="glp-essay-item" data-qid="' + qid + '"';
    html += ' onclick="focusEssayQuestion(' + qid + ')">';
    html += '<span class="glp-essay-qid">#' + qid + '</span>';
    html += '<span class="glp-essay-score" id="glpEsScore_' + qid + '">0/' + max + '</span>';
    html += '</div>';
  }
  list.innerHTML = html;
}

function updateLeftPanelActive(qid) {
  var list = document.getElementById("glpEssayList");
  if (!list) return;
  var items = list.querySelectorAll(".glp-essay-item");
  for (var i = 0; i < items.length; i++) {
    items[i].classList.toggle("active", items[i].getAttribute("data-qid") == qid);
  }
  // 更新分数
  var el = document.getElementById("glpEsScore_" + qid);
  if (el) {
    var kwSuggestion = "";
    var r = null;
    for (var j = 0; j < examResults.length; j++) {
      if (examResults[j].id == qid) { r = examResults[j]; break; }
    }
    if (r && r._kwResult && r._kwResult.keywords.length > 0) {
      kwSuggestion = " (" + r._kwResult.matched.length + "/" + r._kwResult.keywords.length + " 关键词)";
    }
    el.textContent = (gradingScores[qid] || 0) + "/" + (gradingMaxScores[qid] || 5) + kwSuggestion;
  }
}

function focusEssayQuestion(qid) {
  switchGradingQuestion(qid);
  var card = container.querySelector('.question-card[data-qid="' + qid + '"]');
  if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ── 实时计算总分 ────────────────────────────────────── */
function computeRealtimeScore() {
  var types = { single: {}, multiple: {}, judge: {}, fill: {}, essay: {} };
  var totalUser = 0;
  var totalMax = 0;
  var essayGraded = 0;

  for (var i = 0; i < examResults.length; i++) {
    var r = examResults[i];
    var q = findExamData(r.id);
    var qtype = r.qtype;
    var maxS = r.score || (q && q.score) || 0;
    totalMax += maxS;

    var userS = 0;
    if (r.correct === true) {
      userS = maxS;
    } else if (r.correct === null) {
      userS = gradingScores[r.id] || 0;
      if (gradingScores[r.id] !== undefined) essayGraded++;
    }
    totalUser += userS;

    if (!types[qtype]) continue;
    types[qtype].user = (types[qtype].user || 0) + userS;
    types[qtype].max  = (types[qtype].max || 0) + maxS;
    types[qtype].count = (types[qtype].count || 0) + 1;
  }

  // 底部批阅栏
  if (gradingScoreLive) gradingScoreLive.textContent = "总分 " + totalUser + " / " + totalMax;
  if (gradingProgressText) gradingProgressText.textContent = "简答已评 " + essayGraded + "/" + gradingEssayOrder.length + " 题";
  if (gradingDoneBtn) gradingDoneBtn.disabled = (essayGraded < gradingEssayOrder.length);

  // 底部题型标签
  if (gradingTypeBreakdown) {
    var order = ["single", "multiple", "judge", "fill", "essay"];
    var labels = TYPE_ABBR;
    var html = "";
    for (var j = 0; j < order.length; j++) {
      var t = order[j];
      var data = types[t];
      if (!data || !data.count) continue;
      html += '<span class="grading-type-badge">' + labels[t] + ' ' + data.user + '/' + data.max + '</span>';
    }
    gradingTypeBreakdown.innerHTML = html;
  }

  // 左面板
  var glpScore = document.getElementById("glpScore");
  var glpPending = document.getElementById("glpPending");
  if (glpScore) glpScore.textContent = totalUser + " / " + totalMax;
  if (glpPending) glpPending.textContent = (gradingEssayOrder.length - essayGraded) + " 题";

  // 更新左面板每题的评分
  for (var k = 0; k < gradingEssayOrder.length; k++) {
    var qid = gradingEssayOrder[k];
    var el = document.getElementById("glpEsScore_" + qid);
    if (el) el.textContent = (gradingScores[qid] || 0) + "/" + (gradingMaxScores[qid] || 5);
  }

  // 结果面板
  animateScore(0, totalUser, totalMax);
  var totalJudged = 0;
  var correctCount = 0;
  for (var m = 0; m < examResults.length; m++) {
    var rr = examResults[m];
    if (rr.correct !== null || gradingScores[rr.id] !== undefined) {
      totalJudged++;
      var s = (rr.correct === true) ? (rr.score || 0) : (gradingScores[rr.id] || 0);
      if ((rr.correct === true) || s > 0) correctCount++;
    }
  }
  var pct = totalJudged > 0 ? Math.round(correctCount / totalJudged * 100) : 0;
  animateRing(pct);

  if (EXAM_META.passing_score != null) {
    if (essayGraded === gradingEssayOrder.length) {
      if (totalUser >= EXAM_META.passing_score) {
        passStatus.className = "pass";
        passStatus.textContent = "恭喜，你已通过考试！";
      } else {
        passStatus.className = "fail";
        passStatus.textContent = "未达到及格线 (" + EXAM_META.passing_score + " 分)，继续努力！";
      }
    } else {
      passStatus.className = "";
      passStatus.textContent = "批阅中…";
    }
  }

  buildReviewList();
  updateNavResults();
  fillScoreTypeSummary();
}

/* ── 完成批阅 ────────────────────────────────────────── */
function onGradingDone() {
  for (var i = 0; i < examResults.length; i++) {
    var r = examResults[i];
    if (r.correct !== null) continue;
    var gs = gradingScores[r.id];
    if (gs === undefined) continue;
    r.score = gs;
    r.correct = gs > 0;
  }

  if (gradingBar) gradingBar.classList.add("hidden");
  if (gradingLeftPanel) gradingLeftPanel.classList.add("hidden");
  if (gradingRightPanel) gradingRightPanel.classList.add("hidden");
  var sheet = document.getElementById("gradingSheet");
  if (sheet) { sheet.classList.remove("open"); sheet.classList.add("hidden"); }
  resetBtn.classList.remove("hidden");
  gradingActive = false;
  addPrintBtn();
  clearSavedAnswers();

  // 手机端：恢复交卷按钮
  var mtbSubmitBtn = document.getElementById("mtbSubmitBtn");
  if (mtbSubmitBtn) {
    mtbSubmitBtn.textContent = "交卷";
    mtbSubmitBtn.classList.add("hidden");
    mtbSubmitBtn.removeAttribute("data-grading");
  }
  // 计算总分用于打印成绩单
  var reportTotal = 0; var reportMax = 0;
  for (var i = 0; i < examResults.length; i++) {
    var rr = examResults[i];
    reportMax += rr.score || 0;
    if (rr.correct === true) reportTotal += rr.score || 0;
    else if (gradingScores[rr.id]) reportTotal += gradingScores[rr.id];
  }
  fillPrintReport(reportTotal, reportMax);

  reRenderMath();
  computeRealtimeScore();
  updateNavResults();
}

/* ── 滚动监听：自动切换当前批阅题目 ─────────────────── */
function updateGradingFocus() {
  if (!gradingActive) return;
  // 找到当前视口中最靠上的简答题
  var best = null;
  var bestTop = Infinity;
  for (var i = 0; i < gradingEssayOrder.length; i++) {
    var card = container.querySelector('.question-card[data-qid="' + gradingEssayOrder[i] + '"]');
    if (!card) continue;
    var rect = card.getBoundingClientRect();
    // 卡片顶部在视口内（或稍微超出上方）
    if (rect.bottom > 200 && rect.top < window.innerHeight - 200) {
      if (rect.top < bestTop) { bestTop = rect.top; best = gradingEssayOrder[i]; }
    }
  }
  if (best && best !== gradingCurrentQid) {
    switchGradingQuestion(best);
  }
}

/* ── 工具 ────────────────────────────────────────────── */
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
