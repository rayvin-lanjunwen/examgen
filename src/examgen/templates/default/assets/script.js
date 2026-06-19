/* ── 题型常量 ─────────────────────────────────────────── */
var QT = {
  SINGLE:   "single",
  MULTIPLE: "multiple",
  JUDGE:    "judge",
  FILL:     "fill",
  ESSAY:    "essay"
};

var TYPE_LABELS = {};
TYPE_LABELS[QT.SINGLE]   = "单选题";
TYPE_LABELS[QT.MULTIPLE] = "多选题";
TYPE_LABELS[QT.JUDGE]    = "判断题";
TYPE_LABELS[QT.FILL]     = "填空题";
TYPE_LABELS[QT.ESSAY]    = "简答题";

/* ── DOM 引用 ────────────────────────────────────────── */
var container = document.getElementById("questions-container");
var submitBtn = document.getElementById("submit-btn");
var resetBtn  = document.getElementById("reset-btn");
var scoreArea = document.getElementById("score-area");
var scoreDisp = document.getElementById("score-display");
var passStatus = document.getElementById("pass-status");

/* ── 页面加载：渲染题目 ─────────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
  renderQuestions(EXAM_DATA);
  submitBtn.addEventListener("click", onSubmit);
  resetBtn.addEventListener("click", onReset);

  // 倒计时
  if (EXAM_META && EXAM_META.time) {
    startCountdown(EXAM_META.time * 60);
  }
});

/* ── 渲染所有题目 ───────────────────────────────────── */
function renderQuestions(questions) {
  container.innerHTML = "";
  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    container.appendChild(buildQuestionCard(q));
  }
}

/* ── 构建单道题卡片 ─────────────────────────────────── */
function buildQuestionCard(q) {
  var card = document.createElement("div");
  card.className = "question-card";
  card.setAttribute("data-qid", q.id);
  card.setAttribute("data-qtype", q.qtype);

  // 头部
  var header = document.createElement("div");
  header.className = "question-header";
  header.innerHTML =
    '<span class="question-type">' + TYPE_LABELS[q.qtype] + '</span>' +
    q.id + ". " + escapeHTML(q.topic) +
    '<span class="question-score">' + (q.score || 0) + ' 分</span>';
  card.appendChild(header);

  // 答题区域
  if (q.qtype === QT.SINGLE || q.qtype === QT.MULTIPLE || q.qtype === QT.JUDGE) {
    card.appendChild(buildOptions(q));
  } else if (q.qtype === QT.FILL) {
    card.appendChild(buildFillInput(q));
  } else if (q.qtype === QT.ESSAY) {
    card.appendChild(buildEssayInput(q));
  }

  // 解析（初始隐藏）
  if (q.explanation) {
    var exp = document.createElement("div");
    exp.className = "explanation";
    exp.setAttribute("data-qid", q.id);
    exp.innerHTML = "<strong>解析：</strong>" + escapeHTML(q.explanation);
    card.appendChild(exp);
  }

  return card;
}

/* ── 选项列表（单选 / 多选 / 判断） ─────────────────── */
function buildOptions(q) {
  var ul = document.createElement("ul");
  ul.className = "options-list";
  var inputType = q.qtype === QT.MULTIPLE ? "checkbox" : "radio";

  for (var i = 0; i < q.options.length; i++) {
    var opt = q.options[i];
    var li = document.createElement("li");
    li.className = "option-item";
    li.setAttribute("data-label", opt.label);

    var input = document.createElement("input");
    input.type = inputType;
    input.name = "q_" + q.id;
    input.value = opt.label;
    input.setAttribute("data-qid", q.id);
    input.setAttribute("data-qtype", q.qtype);

    var span = document.createElement("span");
    span.textContent = opt.label + ". " + opt.text;

    li.appendChild(input);
    li.appendChild(span);
    ul.appendChild(li);
  }
  return ul;
}

/* ── 填空输入 ───────────────────────────────────────── */
function buildFillInput(q) {
  var wrap = document.createElement("div");
  var input = document.createElement("input");
  input.type = "text";
  input.className = "fill-input";
  input.setAttribute("data-qid", q.id);
  input.setAttribute("data-qtype", q.qtype);
  input.placeholder = "请输入答案，多个答案用 | 分隔";
  wrap.appendChild(input);
  return wrap;
}

/* ── 简答输入 ───────────────────────────────────────── */
function buildEssayInput(q) {
  var wrap = document.createElement("div");
  var ta = document.createElement("textarea");
  ta.className = "essay-textarea";
  ta.setAttribute("data-qid", q.id);
  ta.setAttribute("data-qtype", q.qtype);
  ta.placeholder = "请输入你的答案…";
  wrap.appendChild(ta);
  return wrap;
}

/* ── 提交答卷 ───────────────────────────────────────── */
function onSubmit() {
  var results = collectAnswers();
  var totalScore = 0;
  var maxScore = 0;

  for (var i = 0; i < EXAM_DATA.length; i++) {
    var q = EXAM_DATA[i];
    var userAns = results[q.id];
    var score = q.score || 0;
    maxScore += score;

    if (q.qtype === QT.ESSAY) {
      // 简答不做自动判分，仅显示参考答案
      highlightEssay(q);
      totalScore += score; // 默认给满分，后续可人工评阅
    } else {
      var correct = isCorrect(q, userAns);
      if (correct) {
        totalScore += score;
      }
      highlightResult(q, userAns, correct);
    }

    // 显示解析
    var expEl = container.querySelector('.explanation[data-qid="' + q.id + '"]');
    if (expEl) {
      expEl.classList.add("show");
    }
  }

  // 显示得分
  scoreArea.classList.remove("hidden");
  var percent = maxScore > 0 ? (totalScore / maxScore * 100).toFixed(1) : 0;
  scoreDisp.textContent = totalScore + " / " + maxScore + " 分 (" + percent + "%)";

  // 及格判定
  if (EXAM_META.passing_score != null) {
    if (totalScore >= EXAM_META.passing_score) {
      passStatus.className = "pass";
      passStatus.textContent = "恭喜，你已通过考试！";
    } else {
      passStatus.className = "fail";
      passStatus.textContent = "未达到及格线 (" + EXAM_META.passing_score + " 分)，继续努力！";
    }
  }

  // 禁用控件
  disableInputs();
  submitBtn.classList.add("hidden");
  resetBtn.classList.remove("hidden");

  // 滚动到得分区
  scoreArea.scrollIntoView({ behavior: "smooth" });
}

/* ── 收集用户答案 ───────────────────────────────────── */
function collectAnswers() {
  var answers = {};

  // 选择 / 判断
  var checked = container.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
  for (var i = 0; i < checked.length; i++) {
    var qid = checked[i].getAttribute("data-qid");
    if (!answers[qid]) answers[qid] = "";
    answers[qid] += checked[i].value;
  }

  // 填空
  var fills = container.querySelectorAll(".fill-input");
  for (var j = 0; j < fills.length; j++) {
    answers[fills[j].getAttribute("data-qid")] = fills[j].value.trim();
  }

  // 简答
  var essays = container.querySelectorAll(".essay-textarea");
  for (var k = 0; k < essays.length; k++) {
    answers[essays[k].getAttribute("data-qid")] = essays[k].value.trim();
  }

  return answers;
}

/* ── 判题 ────────────────────────────────────────────── */
function isCorrect(q, userAns) {
  if (userAns == null) return false;
  var norm = function (s) { return (s || "").toUpperCase().replace(/[\s,，、]/g, ""); };
  if (q.qtype === QT.FILL) {
    // 填空：答案用 | 分隔，逐一比对
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

/* ── 高亮结果 ────────────────────────────────────────── */
function highlightResult(q, userAns, correct) {
  var card = container.querySelector('.question-card[data-qid="' + q.id + '"]');
  if (!card) return;

  if (q.qtype === QT.SINGLE || q.qtype === QT.MULTIPLE || q.qtype === QT.JUDGE) {
    var items = card.querySelectorAll(".option-item");
    for (var i = 0; i < items.length; i++) {
      var label = items[i].getAttribute("data-label");
      var inAnswer = q.answer.indexOf(label) !== -1;
      if (inAnswer) {
        items[i].classList.add("correct");
      }
      // 标记用户选错的
      if (userAns && userAns.indexOf(label) !== -1 && !inAnswer) {
        items[i].classList.add("wrong");
      }
    }
  } else if (q.qtype === QT.FILL) {
    var inp = card.querySelector(".fill-input");
    if (inp) {
      inp.classList.add(correct ? "correct" : "wrong");
      if (!correct) {
        inp.title = "正确答案：" + q.answer;
      }
    }
  }
}

function highlightEssay(q) {
  // 简答仅显示参考答案
}

/* ── 禁用所有控件 ───────────────────────────────────── */
function disableInputs() {
  var inputs = container.querySelectorAll("input, textarea");
  for (var i = 0; i < inputs.length; i++) {
    inputs[i].disabled = true;
  }
}

/* ── 重新作答 ───────────────────────────────────────── */
function onReset() {
  // 清空所有输入
  var inputs = container.querySelectorAll("input, textarea");
  for (var i = 0; i < inputs.length; i++) {
    inputs[i].disabled = false;
    if (inputs[i].type === "radio" || inputs[i].type === "checkbox") {
      inputs[i].checked = false;
    } else {
      inputs[i].value = "";
    }
  }

  // 清除高亮
  var items = container.querySelectorAll(".option-item.correct, .option-item.wrong");
  for (var j = 0; j < items.length; j++) {
    items[j].classList.remove("correct", "wrong");
  }
  var fills = container.querySelectorAll(".fill-input.correct, .fill-input.wrong");
  for (var k = 0; k < fills.length; k++) {
    fills[k].classList.remove("correct", "wrong");
    fills[k].title = "";
  }

  // 隐藏解析
  var exps = container.querySelectorAll(".explanation.show");
  for (var m = 0; m < exps.length; m++) {
    exps[m].classList.remove("show");
  }

  // 重置得分区
  scoreArea.classList.add("hidden");
  passStatus.textContent = "";
  passStatus.className = "";

  // 恢复按钮
  submitBtn.classList.remove("hidden");
  resetBtn.classList.add("hidden");

  // 恢复倒计时
  if (EXAM_META && EXAM_META.time) {
    startCountdown(EXAM_META.time * 60);
  }
}

/* ── 倒计时 ──────────────────────────────────────────── */
var countdownTimer = null;
function startCountdown(totalSeconds) {
  if (countdownTimer) clearInterval(countdownTimer);
  var remaining = totalSeconds;
  var el = document.getElementById("countdown");
  if (!el) return;

  function tick() {
    var m = Math.floor(remaining / 60);
    var s = remaining % 60;
    el.textContent = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      el.textContent = "时间到！";
      onSubmit();
      return;
    }
    remaining--;
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* ── 工具函数 ────────────────────────────────────────── */
function escapeHTML(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
