/* ── 构建侧边导航 ──────────────────────────────────── */
function buildNavSidebar(questions) {
  navList.innerHTML = "";
  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    var li = document.createElement("li");
    li.className = "nav-item";
    li.setAttribute("data-qid", q.id);
    li.innerHTML =
      '<span class="nav-badge ' + q.qtype + '">' + (TYPE_ABBR[q.qtype] || "") + '</span>' +
      q.id +
      '<span class="nav-done" data-qid="' + q.id + '">✓</span>';
    li.addEventListener("click", function (e) {
      var qid = this.getAttribute("data-qid");
      var card = container.querySelector('.question-card[data-qid="' + qid + '"]');
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, null, "#q" + qid);
      }
    });
    navList.appendChild(li);
  }
  progressText.textContent = "0/" + questions.length;
}

/* ── 滚动高亮当前题目 ──────────────────────────────── */
function highlightCurrentNav() {
  var items = navList.querySelectorAll(".nav-item");
  var currentId = null;
  var minDist = Infinity;

  for (var i = 0; i < EXAM_DATA.length; i++) {
    var card = container.querySelector('.question-card[data-qid="' + EXAM_DATA[i].id + '"]');
    if (!card) continue;
    var rect = card.getBoundingClientRect();
    var dist = Math.abs(rect.top - 200);
    if (dist < minDist) { minDist = dist; currentId = EXAM_DATA[i].id; }
  }

  for (var j = 0; j < items.length; j++) { items[j].classList.remove("active"); }
  if (currentId) {
    var activeItem = navList.querySelector('.nav-item[data-qid="' + currentId + '"]');
    if (activeItem) activeItem.classList.add("active");
  }
}

/* ── 更新答题进度 ──────────────────────────────────── */
function updateProgress() {
  var answered = 0;
  for (var i = 0; i < EXAM_DATA.length; i++) {
    var qid = EXAM_DATA[i].id;
    var done = false;
    var qtype = EXAM_DATA[i].qtype;

    if (qtype === QT.SINGLE || qtype === QT.MULTIPLE || qtype === QT.JUDGE) {
      var checked = container.querySelectorAll('input[name="q_' + qid + '"]:checked');
      done = checked.length > 0;
    } else if (qtype === QT.FILL) {
      var inps = container.querySelectorAll('.fill-inline[data-qid="' + qid + '"]');
      for (var fi = 0; fi < inps.length; fi++) {
        if (inps[fi].value.trim() !== "") { done = true; break; }
      }
    } else if (qtype === QT.ESSAY) {
      var ta = container.querySelector('.essay-textarea[data-qid="' + qid + '"]');
      done = !!ta && ta.value.trim() !== "";
    }
    if (done) answered++;

    var navDone = navList.querySelector('.nav-done[data-qid="' + qid + '"]');
    if (navDone) {
      if (done) { navDone.classList.add("done"); }
      else { navDone.classList.remove("done"); }
    }
  }
  var total = EXAM_DATA.length;
  var pct = total > 0 ? Math.round(answered / total * 100) : 0;
  progressFill.style.width = pct + "%";
  progressText.textContent = answered + "/" + total;
}

/* ── 提交后更新导航栏对错状态 ─────────────────────── */
function updateNavResults() {
  // 累计各题型得分
  var typeStats = {};
  var typeOrder = [QT.SINGLE, QT.MULTIPLE, QT.JUDGE, QT.FILL, QT.ESSAY];
  for (var t = 0; t < typeOrder.length; t++) {
    typeStats[typeOrder[t]] = { correct: 0, total: 0, maxScore: 0, userScore: 0 };
  }
  var totalCorrect = 0;
  var totalJudged = 0;
  var totalUserScore = 0;
  var totalMaxScore = 0;

  for (var i = 0; i < examResults.length; i++) {
    var r = examResults[i];
    var q = findExamData(r.id);
    var qtype = r.qtype || (q && q.qtype);
    var maxS = r.score || (q && q.score) || 0;

    if (!typeStats[qtype]) typeStats[qtype] = { correct: 0, total: 0, maxScore: 0, userScore: 0 };
    typeStats[qtype].total++;
    typeStats[qtype].maxScore += maxS;
    totalMaxScore += maxS;

    if (r.correct === true) {
      typeStats[qtype].correct++;
      typeStats[qtype].userScore += maxS;
      totalCorrect++;
      totalJudged++;
      totalUserScore += maxS;
    } else if (r.correct === false) {
      totalJudged++;
    } else {
      // 简答待评或批阅中
      if (gradingScores && gradingScores[r.id] !== undefined) {
        typeStats[qtype].userScore += gradingScores[r.id];
        totalUserScore += gradingScores[r.id];
        if (gradingScores[r.id] > 0) { typeStats[qtype].correct++; totalCorrect++; }
        totalJudged++;
      }
    }
  }

  // 构建摘要 HTML
  var summary = '';
  if (totalJudged > 0) {
    summary += '<div class="nav-result-score">' + totalUserScore + ' / ' + totalMaxScore + ' 分</div>';
  }
  summary += '<div class="nav-result-types">';

  for (var j = 0; j < typeOrder.length; j++) {
    var tt = typeOrder[j];
    var st = typeStats[tt];
    if (!st || !st.total) continue;
    var brief = TYPE_ABBR[tt];
    summary += '<div class="nav-result-type">'
      + '<span class="nav-result-type-label">' + brief + '</span>'
      + '<span class="nav-result-type-count">' + st.correct + '/' + st.total + '</span>'
      + '</div>';
  }
  summary += '</div>';

  navResult.innerHTML = summary;
  navResult.classList.remove("hidden");

  // 下面更新每道题的对错状态
  for (var k = 0; k < examResults.length; k++) {
    var r2 = examResults[k];
    var navItem = navList.querySelector('.nav-item[data-qid="' + r2.id + '"]');
    if (!navItem) continue;
    navItem.classList.remove("nav-correct", "nav-wrong", "nav-essay");
    var navDone = navItem.querySelector(".nav-done");
    if (!navDone) continue;
    navDone.classList.add("done");
    if (r2.correct === true) {
      navItem.classList.add("nav-correct");
      navDone.textContent = "✓";
    } else if (r2.correct === false) {
      navItem.classList.add("nav-wrong");
      navDone.textContent = "✗";
    } else {
      // 简答题：批阅后更新
      if (gradingScores && gradingScores[r2.id] !== undefined && gradingScores[r2.id] > 0) {
        navItem.classList.add("nav-correct");
        navDone.textContent = "✓";
      } else {
        navItem.classList.add("nav-essay");
        navDone.textContent = "?";
      }
    }
  }
}
