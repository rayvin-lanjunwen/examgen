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
    if (parts.length !== userParts.length) return false;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] !== userParts[i]) return false;
    }
    return true;
  }
  return norm(userAns) === norm(q.answer);
}

/* ── 判分高亮 ───────────────────────────────────────── */
function highlightResult(q, userAns, correct) {
  var card = container.querySelector('.question-card[data-qid="' + q.id + '"]');
  if (!card) return;
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
      if (!correct) inps[j].title = "正确答案：" + q.answer;
    }
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

    item.innerHTML =
      '<span class="review-icon ' + iconCls + '">' + iconText + '</span>' +
      '<span class="review-qid">#' + r.id + '</span>' +
      '<span class="review-topic">' + escapeHTML(r.topic.substring(0, 40)) + '</span>' +
      '<span class="review-score">' + (r.correct === null ? "待评" : r.score + "分") + '</span>';

    reviewList.appendChild(item);
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
    var confirmMsg = "还有 " + unanswered.length + " 道题未作答，确定要提交吗？\n\n未作答：" + unanswered.join("、");
    if (!confirm(confirmMsg)) return;
  }

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
      examResults.push({ id: q.id, correct: null, score: 0, topic: q.topic, qtype: q.qtype });
    } else {
      maxScore += score;
      totalJudged++;
      var correct = isCorrect(q, userAns);
      if (correct) { totalScore += score; correctCount++; }
      highlightResult(q, userAns, correct);
      examResults.push({ id: q.id, correct: correct, score: correct ? score : 0, topic: q.topic, qtype: q.qtype });
    }

    var expEl = container.querySelector('.explanation[data-qid="' + q.id + '"]');
    if (expEl) expEl.classList.add("show");
  }

  // 显示得分（带滚动动画）
  scoreArea.classList.remove("hidden");
  animateScore(0, totalScore, maxScore);

  // 环形图
  var pct = totalJudged > 0 ? Math.round(correctCount / totalJudged * 100) : 0;
  animateRing(pct);

  // 逐题回顾
  buildReviewList();

  // 及格状态
  if (EXAM_META.passing_score != null) {
    if (totalScore >= EXAM_META.passing_score) {
      passStatus.className = "pass";
      passStatus.textContent = "恭喜，你已通过考试！";
    } else {
      passStatus.className = "fail";
      passStatus.textContent = "未达到及格线 (" + EXAM_META.passing_score + " 分)，继续努力！";
    }
  }

  disableInputs();
  submitBtn.classList.add("hidden");
  resetBtn.classList.remove("hidden");
  scoreArea.scrollIntoView({ behavior: "smooth" });

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

  scoreArea.classList.add("hidden");
  passStatus.textContent = "";
  passStatus.className = "";
  submitBtn.classList.remove("hidden");
  resetBtn.classList.add("hidden");
  updateProgress();
  if (EXAM_META && EXAM_META.time) {
    startCountdown(EXAM_META.time * 60);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
