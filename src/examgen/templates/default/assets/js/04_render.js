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
  // 填空题：标题只显示题号+分值，题干在 buildFillInput 中完整渲染
  var headerTopic = (q.qtype === QT.FILL) ? '' : '<div class="topic-md">' + mdToHTML(q.topic) + '</div>';
  header.innerHTML =
    '<span class="question-type" data-type="' + q.qtype + '">' + TYPE_LABELS[q.qtype] + '</span>' +
    '<span class="question-number">' + q.id + '.</span>' +
    headerTopic +
    '<span class="question-score">' +
      (q.score || 0) + ' 分' +
      '<span class="question-bookmark" data-qid="' + q.id + '" title="点击标记待复查"></span>' +
    '</span>';
  card.appendChild(header);

  // 题卡上书签点击
  setTimeout(function() {
    var bm = card.querySelector('.question-bookmark');
    if (bm) {
      bm.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof toggleBookmark === "function") toggleBookmark(bm.getAttribute('data-qid'));
      });
    }
  }, 0);

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
    circle.textContent = opt.label;

    var text = document.createElement("span");
    text.className = "option-text";
    text.innerHTML = mdToHTML(opt.text);

    label.appendChild(input);
    label.appendChild(circle);
    label.appendChild(text);
    li.appendChild(label);
    ul.appendChild(li);
  }
  return ul;
}

/* ── 填空题：将题干中的 ____ 或 ** 替换为内联输入框 ─── */
function buildFillInput(q) {
  var wrap = document.createElement("div");
  wrap.className = "fill-wrap";

  // 支持两种空位标记：____ 和 **
  var topic = q.topic || "";

  // 保护 LaTeX 公式，防止 ** 替换破坏公式内容
  var fillMathBlocks = [];
  topic = topic.replace(/\$\$([\s\S]*?)\$\$/g, function (match) {
    fillMathBlocks.push(match);
    return "\uFFF0M" + (fillMathBlocks.length - 1) + "M\uFFF0";
  });
  topic = topic.replace(/\$([^$]+?)\$/g, function (match) {
    fillMathBlocks.push(match);
    return "\uFFF0M" + (fillMathBlocks.length - 1) + "M\uFFF0";
  });

  // 先统一把 ** 转成 ____
  topic = topic.replace(/\*\*/g, "____");

  // 恢复公式
  topic = topic.replace(/\uFFF0M(\d+)M\uFFF0/g, function (_, idx) {
    return fillMathBlocks[parseInt(idx)];
  });

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
