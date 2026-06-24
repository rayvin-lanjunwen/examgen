/* ── 题目标记（书签）系统 ──────────────────────────── */
var bookmarkedSet = new Set();   // 已标记的 qid 集合

/* ── 在导航栏项上添加书签图标 ───────────────────── */
function addBookmarkToNav(qid) {
  var navItem = navList.querySelector('.nav-item[data-qid="' + qid + '"]');
  if (!navItem) return;
  // 检查是否已存在书签按钮
  if (navItem.querySelector(".nav-bookmark")) return;

  var bm = document.createElement("span");
  bm.className = "nav-bookmark";
  bm.setAttribute("data-qid", qid);
  bm.textContent = "☆";
  bm.title = "点击标记为待复查";
  bm.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleBookmark(qid);
  });
  // 插入在 nav-done 之前
  var done = navItem.querySelector(".nav-done");
  if (done) {
    navItem.insertBefore(bm, done);
  } else {
    navItem.appendChild(bm);
  }
}

/* ── 切换书签状态 ────────────────────────────────── */
function toggleBookmark(qid, silent) {
  if (bookmarkedSet.has(qid)) {
    bookmarkedSet.delete(qid);
    updateBookmarkUI(qid, false);
  } else {
    bookmarkedSet.add(qid);
    updateBookmarkUI(qid, true);
  }
  if (!silent) saveAnswersToStorage();
}

function updateBookmarkUI(qid, active) {
  // 侧边栏图标
  var navItem = navList.querySelector('.nav-item[data-qid="' + qid + '"]');
  if (navItem) {
    var bm = navItem.querySelector(".nav-bookmark");
    if (bm) {
      bm.textContent = active ? "★" : "☆";
      bm.title = active ? "已标记，点击取消" : "点击标记为待复查";
      if (active) bm.classList.add("active");
      else bm.classList.remove("active");
    }
  }

  // 题卡图标
  var card = container.querySelector('.question-card[data-qid="' + qid + '"]');
  if (card) {
    if (active) card.classList.add("bookmarked");
    else card.classList.remove("bookmarked");
    var cardBm = card.querySelector(".question-bookmark");
    if (cardBm) {
      cardBm.textContent = active ? "★" : "☆";
      if (active) cardBm.classList.add("active");
      else cardBm.classList.remove("active");
    }
  }

  // 成绩界面复盘列表
  var reviewItem = reviewList.querySelector('.review-item[data-qid="' + qid + '"]');
  if (reviewItem) {
    var reviewBm = reviewItem.querySelector(".review-bookmark");
    if (!reviewBm) {
      reviewBm = document.createElement("span");
      reviewBm.className = "review-bookmark";
      reviewItem.appendChild(reviewBm);
    }
    reviewBm.textContent = active ? "★" : "☆";
  }
}

/* ── 初始化：给每个导航项添加书签图标 ──────────── */
function initBookmarks() {
  for (var i = 0; i < EXAM_DATA.length; i++) {
    addBookmarkToNav(EXAM_DATA[i].id);
  }
}

/* ── 构建复盘列表时附加书签标记 ────────────────── */
function enhanceReviewListWithBookmarks() {
  var items = reviewList.querySelectorAll(".review-item");
  for (var i = 0; i < items.length; i++) {
    var qid = items[i].getAttribute("data-qid");
    if (bookmarkedSet.has(qid)) {
      var bm = document.createElement("span");
      bm.className = "review-bookmark";
      bm.textContent = "★";
      items[i].appendChild(bm);
    }
  }
}
