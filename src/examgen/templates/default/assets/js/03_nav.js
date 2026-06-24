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
