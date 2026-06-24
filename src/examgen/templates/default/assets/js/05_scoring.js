/* ── 状态 ───────────────────────────────────────────── */
var examResults = []; // 存储每题判分结果

/* ── 收集答案 ───────────────────────────────────────── */
function collectAnswers() {
  var answers = {};
  var checked = container.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
  for (var i = 0; i < checked.length; i++) {
    var qid = checked[i].getAttribute("data-qid");
    if (!answers[qid]) answers[qid] = "";
    answers[qid] += checked[i].value;
  }
  var fills = container.querySelectorAll(".fill-inline");
  for (var j = 0; j < fills.length; j++) {
    var fqid = fills[j].getAttribute("data-qid");
    if (!answers[fqid]) answers[fqid] = "";
    if (answers[fqid]) answers[fqid] += "|";
    answers[fqid] += fills[j].value.trim();
  }
  var essays = container.querySelectorAll(".essay-textarea");
  for (var k = 0; k < essays.length; k++) {
    answers[essays[k].getAttribute("data-qid")] = essays[k].value.trim();
  }
  return answers;
}

/* ── 答案判对 ───────────────────────────────────────── */
function isCorrect(q, userAns) {
  if (userAns == null) return false;
  var norm = function (s) { return (s || "").toUpperCase().replace(/[\s,，、]/g, ""); };
  if (q.qtype === QT.FILL) {
    var parts = q.answer.split("|").map(norm);
    var userParts = userAns.split("|").map(norm);
    while (userParts.length > 0 && userParts[userParts.length - 1] === "") {
      userParts.pop();
    }
    if (userParts.length === 1) {
      for (var i = 0; i < parts.length; i++) {
        if (userParts[0] === parts[i]) return true;
      }
      return false;
    }
    if (parts.length !== userParts.length) return false;
    for (var j = 0; j < parts.length; j++) {
      if (parts[j] !== userParts[j]) return false;
    }
    return true;
  }
  return norm(userAns) === norm(q.answer);
}

/* ── 简答关键词半自动判分 ──────────────────────────── */
function scoreEssayByKeywords(q, userAns) {
  if (!userAns || !q.explanation) {
    return { score: 0, keywords: [], matched: [], suggestion: "" };
  }
  // 从解析中提取关键词：以 "关键词:" 或 "关键词：" 开头的行
  var kwMatch = q.explanation.match(/关键词[:：]\s*(.+)/i);
  if (!kwMatch) return { score: 0, keywords: [], matched: [], suggestion: "" };

  var keywords = kwMatch[1].split(/[,，、\s]+/).filter(function(k) { return k.length > 0; });
  if (keywords.length === 0) return { score: 0, keywords: [], matched: [], suggestion: "" };

  var userLower = userAns.toLowerCase();
  var matched = [];
  for (var i = 0; i < keywords.length; i++) {
    if (userLower.indexOf(keywords[i].toLowerCase()) !== -1) {
      matched.push(keywords[i]);
    }
  }

  var score = 0;
  var maxScore = q.score || 0;
  if (keywords.length > 0 && maxScore > 0) {
    score = Math.round(maxScore * matched.length / keywords.length);
  }

  var suggestion = matched.length === 0
    ? "未匹配到关键词，建议人工评估"
    : "匹配 " + matched.length + "/" + keywords.length + " 个关键词，建议 " + score + " 分";

  return { score: score, keywords: keywords, matched: matched, suggestion: suggestion };
}

/* ── 判分高亮 ───────────────────────────────────────── */
function highlightResult(q, userAns, correct) {
  var card = container.querySelector('.question-card[data-qid="' + q.id + '"]');
  if (!card) return;
  
  // 为每道题添加可见的正确答案展示
  var existing = card.querySelector(".answer-display");
  if (existing) existing.remove();
  
  if (q.qtype === QT.SINGLE || q.qtype === QT.MULTIPLE || q.qtype === QT.JUDGE) {
    var items = card.querySelectorAll(".option-item");
    for (var i = 0; i < items.length; i++) {
      var label = items[i].getAttribute("data-label");
      var inAnswer = q.answer.indexOf(label) !== -1;
      if (inAnswer) items[i].classList.add("correct");
      if (userAns && userAns.indexOf(label) !== -1 && !inAnswer) items[i].classList.add("wrong");
    }
  } else if (q.qtype === QT.FILL) {
    var inps = card.querySelectorAll(".fill-inline");
    for (var j = 0; j < inps.length; j++) {
      inps[j].classList.add(correct ? "correct" : "wrong");
      if (!correct && j === 0) {
        inps[j].title = "正确答案：" + q.answer;
      }
    }
  }
  
  // 可见的正确答案显示（所有题型），放在解析之前
  var answerDiv = document.createElement("div");
  answerDiv.className = "answer-display";
  if (correct) {
    answerDiv.classList.add("answer-display--correct");
    answerDiv.innerHTML = '<span class="answer-display-icon correct-icon">&#10003;</span> 回答正确';
  } else {
    answerDiv.classList.add("answer-display--wrong");
    answerDiv.innerHTML = '<span class="answer-display-icon wrong-icon">&#10007;</span> 正确答案：<span class="answer-display-text">' + mdToHTML(q.answer) + '</span>';
  }
  
  // 插入到解析之前（如果存在），否则追加到末尾
  var explanation = card.querySelector(".explanation");
  if (explanation) {
    card.insertBefore(answerDiv, explanation);
  } else {
    card.appendChild(answerDiv);
  }
  
  // 渲染答案中的公式
  if (typeof renderMathInElement !== "undefined") {
    renderMathInElement(answerDiv, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$",  right: "$",  display: false }
      ]
    });
  }
}

function highlightEssay(q) {
  var card = container.querySelector('.question-card[data-qid="' + q.id + '"]');
  if (!card) return;
  var ref = card.querySelector(".essay-reference");
  if (ref) ref.classList.add("show");
  var ta = card.querySelector(".essay-textarea");
  if (ta) ta.disabled = true;
}

function disableInputs() {
  var inputs = container.querySelectorAll("input, textarea");
  for (var i = 0; i < inputs.length; i++) { inputs[i].disabled = true; }
}

/* ── 分数滚动动画 ───────────────────────────────────── */
function animateScore(from, to, max) {
  var duration = 800;
  var start = Date.now();
  function step() {
    var elapsed = Date.now() - start;
    var progress = Math.min(elapsed / duration, 1);
    // easeOutExpo
    var eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    var current = Math.round(from + (to - from) * eased);
    scoreDisp.textContent = current + " / " + max + " 分";
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── 环形进度图动画 ─────────────────────────────────── */
function animateRing(pct) {
  var ring = document.getElementById("ringFill");
  var label = document.getElementById("ringPercent");
  if (!ring || !label) return;
  var circumference = 2 * Math.PI * 52; // ≈ 326.7
  var target = circumference * pct / 100;

  var current = 0;
  var duration = 1000;
  var start = Date.now();
  function step() {
    var elapsed = Date.now() - start;
    var progress = Math.min(elapsed / duration, 1);
    var eased = 1 - Math.pow(2, -10 * progress);
    var val = current + (target - current) * eased;
    ring.setAttribute("stroke-dasharray", val.toFixed(1) + " " + circumference);
    var displayPct = Math.round(pct * progress);
    label.textContent = displayPct + "%";
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── 逐题回顾列表 ───────────────────────────────────── */
function buildReviewList() {
  reviewList.innerHTML = "";
  for (var i = 0; i < examResults.length; i++) {
    var r = examResults[i];
    var item = document.createElement("div");
    item.className = "review-item";
    item.setAttribute("data-qid", r.id);
    item.addEventListener("click", function () {
      var qid = this.getAttribute("data-qid");
      var card = container.querySelector('.question-card[data-qid="' + qid + '"]');
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    var iconCls = r.correct === null ? "essay" : (r.correct ? "correct" : "wrong");
    var iconText = r.correct === null ? "?" : (r.correct ? "✓" : "✗");

    // 批阅模式中的简答题显示当前评分
    var scoreText;
    if (r.correct === null) {
      var gs = gradingScores[r.id];
      if (gs !== undefined && gs > 0) {
        scoreText = gs + "分";
        iconCls = "correct";
        iconText = "✓";
      } else if (gs !== undefined && gs === 0) {
        scoreText = "0分";
        iconCls = "wrong";
        iconText = "✗";
      } else {
        scoreText = "待评";
      }
    } else {
      scoreText = r.score + "分";
    }

    item.innerHTML =
      '<span class="review-icon ' + iconCls + '">' + iconText + '</span>' +
      '<span class="review-qid">#' + r.id + '</span>' +
      '<span class="review-topic">' + escapeHTML(r.topic.substring(0, 40)) + '</span>' +
      '<span class="review-score">' + scoreText + '</span>';

    reviewList.appendChild(item);
  }
  // 附加书签标记
  if (typeof enhanceReviewListWithBookmarks === "function") {
    enhanceReviewListWithBookmarks();
  }
}

/* ── 侧边栏未答题提示 ───────────────────────────── */
function showUnansweredInSidebar(unanswered) {
  if (!navUnanswered || !navUnansweredList) return;
  navUnansweredList.innerHTML = "";
  for (var i = 0; i < unanswered.length; i++) {
    var span = document.createElement("span");
    span.className = "nav-unanswered-item";
    span.textContent = "#" + unanswered[i];
    span.addEventListener("click", function() {
      var qid = this.textContent.replace("#", "");
      var card = container.querySelector('.question-card[data-qid="' + qid + '"]');
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    navUnansweredList.appendChild(span);
  }
  navUnanswered.classList.remove("hidden");
}

/* ── 填充打印成绩单 ──────────────────────────────── */
function fillPrintReport(totalScore, totalMax) {
  if (!printReport || !printReportScore) return;
  printReportScore.textContent = totalScore + " / " + totalMax + " 分";

  // 及格状态
  if (EXAM_META.passing_score != null) {
    if (totalScore >= EXAM_META.passing_score) {
      printReportPass.textContent = "✔ 已通过（及格线 " + EXAM_META.passing_score + " 分）";
      printReportPass.className = "print-report-pass pass";
    } else {
      printReportPass.textContent = "✘ 未通过（及格线 " + EXAM_META.passing_score + " 分）";
      printReportPass.className = "print-report-pass fail";
    }
  }

  // 题型统计
  var typeStats = {};
  for (var i = 0; i < examResults.length; i++) {
    var r = examResults[i];
    var t = r.qtype || (findExamData(r.id) && findExamData(r.id).qtype);
    if (!t) continue;
    if (!typeStats[t]) typeStats[t] = { correct: 0, total: 0, score: 0, maxScore: 0 };
    typeStats[t].total++;
    typeStats[t].maxScore += r.score || 0;
    if (r.correct === true) {
      typeStats[t].correct++;
      typeStats[t].score += r.score || 0;
    } else if (gradingScores && gradingScores[r.id] > 0) {
      typeStats[t].correct++;
      typeStats[t].score += gradingScores[r.id];
    }
  }

  var order = [QT.SINGLE, QT.MULTIPLE, QT.JUDGE, QT.FILL, QT.ESSAY];
  var typesHtml = "";
  for (var j = 0; j < order.length; j++) {
    var t = order[j];
    var ts = typeStats[t];
    if (!ts || !ts.total) continue;
    typesHtml += '<span class="print-report-type"><span>' + TYPE_ABBR[t] + '：</span><span>' + ts.correct + '/' + ts.total + '</span></span>';
  }
  printReportTypes.innerHTML = typesHtml;

  // 逐题列表
  var listHtml = "";
  for (var k = 0; k < examResults.length; k++) {
    var r2 = examResults[k];
    var resultClass = r2.correct === true ? "correct" : (r2.correct === false ? "wrong" : "essay");
    var resultText = r2.correct === true ? "✓ 正确" : (r2.correct === false ? "✗ 错误" : "待评");
    var rowScore = (r2.correct === true || r2.correct === false) ? r2.score : (gradingScores && gradingScores[r2.id] || 0);
    listHtml += '<div class="print-row">'
      + '<span class="print-row-num">#' + r2.id + '</span>'
      + '<span class="print-row-topic">' + escapeHTML((r2.topic || "").substring(0, 60)) + '</span>'
      + '<span class="print-row-result ' + resultClass + '">' + resultText + '</span>'
      + '<span class="print-row-score">' + (rowScore || 0) + ' 分</span>'
      + '</div>';
  }
  printReportList.innerHTML = listHtml;
  printReport.classList.remove("hidden");
}

/* ── 填充题型汇总条 ──────────────────────────────── */
function fillScoreTypeSummary() {
  var el = document.getElementById("scoreTypeSummary");
  if (!el) return;
  var typeStats = {};
  for (var i = 0; i < examResults.length; i++) {
    var r = examResults[i];
    var t = r.qtype || (findExamData(r.id) && findExamData(r.id).qtype);
    if (!t) continue;
    if (!typeStats[t]) typeStats[t] = { correct: 0, total: 0 };
    typeStats[t].total++;
    if (r.correct === true) typeStats[t].correct++;
    else if (gradingScores && gradingScores[r.id] > 0) typeStats[t].correct++;
  }
  var order = [QT.SINGLE, QT.MULTIPLE, QT.JUDGE, QT.FILL, QT.ESSAY];
  var html = "";
  for (var j = 0; j < order.length; j++) {
    var tt = order[j];
    var ts = typeStats[tt];
    if (!ts || !ts.total) continue;
    html += '<span class="score-type-item"><span class="sts-label">' + TYPE_ABBR[tt] + '：</span><span class="sts-count">' + ts.correct + '/' + ts.total + '</span></span>';
  }
  el.innerHTML = html;
  if (html) {
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

/* ── 提交答卷 ───────────────────────────────────────── */
function onSubmit() {
  var unanswered = [];
  for (var i = 0; i < EXAM_DATA.length; i++) {
    var qid = EXAM_DATA[i].id;
    var qtype = EXAM_DATA[i].qtype;
    var answered = false;
    if (qtype === QT.SINGLE || qtype === QT.MULTIPLE || qtype === QT.JUDGE) {
      answered = container.querySelectorAll('input[name="q_' + qid + '"]:checked').length > 0;
    } else if (qtype === QT.FILL) {
      var inps = container.querySelectorAll('.fill-inline[data-qid="' + qid + '"]');
      for (var fi = 0; fi < inps.length; fi++) {
        if (inps[fi].value.trim() !== "") { answered = true; break; }
      }
    } else if (qtype === QT.ESSAY) {
      var ta = container.querySelector('.essay-textarea[data-qid="' + qid + '"]');
      answered = !!ta && ta.value.trim() !== "";
    }
    if (!answered) unanswered.push(qid);
  }

  if (unanswered.length > 0) {
    // 在侧边栏显示未答题提示
    showUnansweredInSidebar(unanswered);
    var confirmMsg = "还有 " + unanswered.length + " 道题未作答，确定要提交吗？";
    if (!confirm(confirmMsg)) return;
  }

  // 收集答案、构建 examResults
  var results = collectAnswers();
  var totalScore = 0;
  var maxScore = 0;
  var correctCount = 0;
  var totalJudged = 0;
  examResults = [];

  for (var i = 0; i < EXAM_DATA.length; i++) {
    var q = EXAM_DATA[i];
    var userAns = results[q.id];
    var score = q.score || 0;

    if (q.qtype === QT.ESSAY) {
      highlightEssay(q);
      examResults.push({ id: q.id, correct: null, score: score, topic: q.topic, qtype: q.qtype });
    } else {
      maxScore += score;
      totalJudged++;
      var correct = isCorrect(q, userAns);
      if (correct) { totalScore += score; correctCount++; }
      highlightResult(q, userAns, correct);
      examResults.push({ id: q.id, correct: correct, score: score, topic: q.topic, qtype: q.qtype });
    }

    var expEl = container.querySelector('.explanation[data-qid="' + q.id + '"]');
    if (expEl) expEl.classList.add("show");
  }

  disableInputs();
  submitBtn.classList.add("hidden");
  clearSavedAnswers();

  // 如果有简答题，进入批阅模式；否则直接显示结果
  if (hasEssayQuestions()) {
    enterGradingMode();
  } else {
    showFinalScore(totalScore, maxScore, totalJudged, correctCount);
  }

  // 停止计时
  if (countdownTimer) clearInterval(countdownTimer);
}

/* ── 重新作答 ───────────────────────────────────────── */
function onReset() {
  examResults = [];
  var inputs = container.querySelectorAll("input, textarea");
  for (var i = 0; i < inputs.length; i++) {
    inputs[i].disabled = false;
    if (inputs[i].type === "radio" || inputs[i].type === "checkbox") {
      inputs[i].checked = false;
    } else {
      inputs[i].value = "";
    }
  }
  var items = container.querySelectorAll(".option-item.correct, .option-item.wrong");
  for (var j = 0; j < items.length; j++) { items[j].classList.remove("correct", "wrong"); }
  var fills = container.querySelectorAll(".fill-inline.correct, .fill-inline.wrong");
  for (var k = 0; k < fills.length; k++) { fills[k].classList.remove("correct", "wrong"); fills[k].title = ""; }
  var exps = container.querySelectorAll(".explanation.show");
  for (var m = 0; m < exps.length; m++) { exps[m].classList.remove("show"); }
  var refs = container.querySelectorAll(".essay-reference.show");
  for (var n = 0; n < refs.length; n++) { refs[n].classList.remove("show"); }
  // 清除答案显示
  var ads = container.querySelectorAll(".answer-display");
  for (var a = 0; a < ads.length; a++) { ads[a].remove(); }
  // 重置导航栏
  var navItems = navList.querySelectorAll(".nav-item.nav-correct, .nav-item.nav-wrong, .nav-item.nav-essay");
  for (var na = 0; na < navItems.length; na++) {
    navItems[na].classList.remove("nav-correct", "nav-wrong", "nav-essay");
    var nd = navItems[na].querySelector(".nav-done");
    if (nd) nd.classList.remove("done");
  }
  // 隐藏结果摘要
  if (navResult) navResult.classList.add("hidden");
  // 隐藏未答题提示
  if (navUnanswered) navUnanswered.classList.add("hidden");
  // 隐藏打印成绩单
  if (printReport) printReport.classList.add("hidden");
  // 隐藏题型汇总
  if (scoreTypeSummary) { scoreTypeSummary.innerHTML = ""; scoreTypeSummary.classList.add("hidden"); }

  // 恢复侧栏
  if (sidebarEl) { sidebarEl.classList.remove("hidden"); }
  if (mainContentEl) { mainContentEl.style.marginLeft = ""; }

  scoreArea.classList.add("hidden");
  passStatus.textContent = "";
  passStatus.className = "";
  submitBtn.classList.remove("hidden");
  resetBtn.classList.add("hidden");
  if (gradingBar) gradingBar.classList.add("hidden");
  gradingScores = {};
  gradingActive = false;

  // 清理批阅面板
  var gps = container.querySelectorAll(".grading-panel");
  for (var p = 0; p < gps.length; p++) { gps[p].remove(); }
  // 重置书签
  bookmarkedSet.clear();
  var bookmarks = document.querySelectorAll(".nav-bookmark");
  for (var bi = 0; bi < bookmarks.length; bi++) { bookmarks[bi].textContent = "☆"; bookmarks[bi].classList.remove("active"); }
  var bmCards = container.querySelectorAll(".question-card.bookmarked");
  for (var bc = 0; bc < bmCards.length; bc++) { bmCards[bc].classList.remove("bookmarked"); }
  // 重置题卡上的书签图标
  var cardBms = container.querySelectorAll(".question-bookmark");
  for (var cbi = 0; cbi < cardBms.length; cbi++) { cardBms[cbi].textContent = "☆"; cardBms[cbi].classList.remove("active"); }
  updateProgress();
  if (EXAM_META && EXAM_META.time) {
    startCountdown(EXAM_META.time * 60);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  clearSavedAnswers();
}

/* ── 显示最终得分 + 打印按钮 ─────────────────────── */
function showFinalScore(totalScore, maxScore, totalJudged, correctCount) {
  scoreArea.classList.remove("hidden");
  animateScore(0, totalScore, maxScore);
  var pct = totalJudged > 0 ? Math.round(correctCount / totalJudged * 100) : 0;
  animateRing(pct);
  buildReviewList();
  updateNavResults();
  if (EXAM_META.passing_score != null) {
    if (totalScore >= EXAM_META.passing_score) {
      passStatus.className = "pass";
      passStatus.textContent = "恭喜，你已通过考试！";
    } else {
      passStatus.className = "fail";
      passStatus.textContent = "未达到及格线 (" + EXAM_META.passing_score + " 分)，继续努力！";
    }
  }
  resetBtn.classList.remove("hidden");
  addPrintBtn();
  fillPrintReport(totalScore, maxScore);

  // 填充题型汇总条
  fillScoreTypeSummary();
  // 重新渲染公式（解析和答案中的 LaTeX）
  reRenderMath();
}

/* ── 打印成绩单按钮 ──────────────────────────────── */
function addPrintBtn() {
  var existing = document.getElementById("printReportBtn");
  if (existing) return;
  var btn = document.createElement("button");
  btn.id = "printReportBtn";
  btn.className = "btn btn-outline";
  btn.textContent = "打印成绩单";
  btn.style.marginLeft = "10px";
  btn.addEventListener("click", function () {
    window.print();
  });
  resetBtn.parentNode.insertBefore(btn, resetBtn.nextSibling);
}
