/* ── 渲染所有题目（含分区标题分隔条） ──────────────── */
function renderQuestions(questions) {
  container.innerHTML = "";
  var lastSection = "";
  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    // 插入分区标题分隔条
    if (q.section && q.section !== lastSection) {
      lastSection = q.section;
      var div = document.createElement("div");
      div.className = "section-divider";
      div.innerHTML =
        '<span class="section-divider-line"></span>' +
        '<span class="section-divider-text">' + escapeHTML(q.section) + '</span>' +
        '<span class="section-divider-line"></span>';
      container.appendChild(div);
    }
    container.appendChild(buildQuestionCard(q));
  }

  if (typeof renderMathInElement !== "undefined") {
    renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$",  right: "$",  display: false }
      ]
    });
  }
}

/* ── 构建单道题卡片 ─────────────────────────────────── */
function buildQuestionCard(q) {
  var card = document.createElement("div");
  card.className = "question-card";
  card.id = "q" + q.id;
  card.setAttribute("data-qid", q.id);
  card.setAttribute("data-qtype", q.qtype);

  var header = document.createElement("div");
  header.className = "question-header";
  header.innerHTML =
    '<span class="question-type" data-type="' + q.qtype + '">' + TYPE_LABELS[q.qtype] + '</span>' +
    '<span class="question-number">' + q.id + '.</span>' +
    '<span class="topic-md">' + mdToHTML(q.topic) + '</span>' +
    '<span class="question-score">' + (q.score || 0) + ' 分</span>';
  card.appendChild(header);

  if (q.qtype === QT.SINGLE || q.qtype === QT.MULTIPLE || q.qtype === QT.JUDGE) {
    card.appendChild(buildOptions(q));
  } else if (q.qtype === QT.FILL) {
    card.appendChild(buildFillInput(q));
  } else if (q.qtype === QT.ESSAY) {
    card.appendChild(buildEssayInput(q));
    if (q.answer) {
      var refAns = document.createElement("div");
      refAns.className = "essay-reference";
      refAns.setAttribute("data-qid", q.id);
      refAns.innerHTML = '<span class="ref-icon">&#128221;</span> 参考答案' + mdToHTML(q.answer);
      card.appendChild(refAns);
    }
  }

  if (q.explanation) {
    var exp = document.createElement("div");
    exp.className = "explanation";
    exp.setAttribute("data-qid", q.id);
    exp.innerHTML = '<span class="exp-icon">&#128161;</span> 解析' + mdToHTML(q.explanation);
    card.appendChild(exp);
  }

  return card;
}

/* ── 选项列表（点击整行即可选中） ──────────────────── */
function buildOptions(q) {
  var ul = document.createElement("ul");
  ul.className = "options-list";
  var inputType = q.qtype === QT.MULTIPLE ? "checkbox" : "radio";
  var letterIcons = ["A", "B", "C", "D"];

  for (var i = 0; i < q.options.length; i++) {
    var opt = q.options[i];
    var li = document.createElement("li");
    li.className = "option-item";
    li.setAttribute("data-label", opt.label);

    var label = document.createElement("label");
    label.className = "option-label";

    var input = document.createElement("input");
    input.type = inputType;
    input.name = "q_" + q.id;
    input.value = opt.label;
    input.setAttribute("data-qid", q.id);
    input.setAttribute("data-qtype", q.qtype);

    var circle = document.createElement("span");
    circle.className = "option-circle";
    circle.textContent = letterIcons[i] || opt.label;

    var text = document.createElement("span");
    text.className = "option-text";
    text.textContent = opt.text;

    label.appendChild(input);
    label.appendChild(circle);
    label.appendChild(text);
    li.appendChild(label);
    ul.appendChild(li);
  }
  return ul;
}

/* ── 填空题：将题干中的 ____ 替换为内联输入框 ─────── */
function buildFillInput(q) {
  var wrap = document.createElement("div");
  wrap.className = "fill-wrap";

  // 按 ____ 拆分题干，交替插入 input
  var topic = q.topic || "";
  var parts = topic.split("____");
  for (var i = 0; i < parts.length; i++) {
    if (i > 0) {
      var input = document.createElement("input");
      input.type = "text";
      input.className = "fill-inline";
      input.setAttribute("data-qid", q.id);
      input.setAttribute("data-qtype", q.qtype);
      input.setAttribute("data-blank-index", i);
      input.placeholder = "第" + i + "空";
      wrap.appendChild(input);
    }
    if (parts[i]) {
      var span = document.createElement("span");
      span.className = "fill-text";
      span.innerHTML = mdToHTML(parts[i]);
      wrap.appendChild(span);
    }
  }
  return wrap;
}

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
