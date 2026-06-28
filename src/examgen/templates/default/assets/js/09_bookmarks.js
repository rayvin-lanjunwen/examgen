/* ====== 题目标记（书签）系统 ====== */
var bookmarkedSet = new Set();

/* ====== SVG 星形图标 ====== */
function starSvg(active) {
  return '<svg class="star-icon" viewBox="0 0 22 22" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M11 1.5l3.09 6.26L21 8.77l-5 4.87 1.18 6.88L11 17.27l-6.18 3.25L6 13.64 1 8.77l6.91-1.01L11 1.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M11 1.5l3.09 6.26L21 8.77l-5 4.87 1.18 6.88L11 17.27l-6.18 3.25L6 13.64 1 8.77l6.91-1.01L11 1.5z" fill="currentColor" class="star-fill" opacity="' + (active ? '1' : '0') + '"/>' +
    '</svg>';
}

/* ====== 在导航栏项上添加书签图标 ====== */
function addBookmarkToNav(qid) {
  var navItem = navList.querySelector('.nav-item[data-qid="' + qid + '"]');
  if (!navItem) return;
  if (navItem.querySelector(".nav-bookmark")) return;

  var bm = document.createElement("span");
  bm.className = "nav-bookmark";
  bm.setAttribute("data-qid", qid);
  bm.innerHTML = starSvg(false);
  bm.title = "点击标记为待复查";
  bm.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleBookmark(qid);
  });
  // 插入在 nav-done 之后
  navItem.appendChild(bm);
}

/* ====== 切换书签状态 ====== */
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
      bm.innerHTML = starSvg(active);
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
      cardBm.innerHTML = starSvg(active);
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
    reviewBm.innerHTML = starSvg(active);
  }
}

/* ====== 初始化：给每个导航项添加书签图标 ====== */
function initBookmarks() {
  for (var i = 0; i < EXAM_DATA.length; i++) {
    addBookmarkToNav(EXAM_DATA[i].id);
  }
  // Initialize card bookmark icons with SVG
  var bms = container.querySelectorAll(".question-bookmark");
  for (var j = 0; j < bms.length; j++) {
    var qid = bms[j].getAttribute("data-qid");
    bms[j].innerHTML = starSvg(bookmarkedSet.has(qid));
  }
}

/* ====== 构建复盘列表时附加书签标记 ====== */
function enhanceReviewListWithBookmarks() {
  var items = reviewList.querySelectorAll(".review-item");
  for (var i = 0; i < items.length; i++) {
    var qid = items[i].getAttribute("data-qid");
    if (bookmarkedSet.has(qid)) {
      var bm = document.createElement("span");
      bm.className = "review-bookmark";
      bm.innerHTML = starSvg(true);
      items[i].appendChild(bm);
    }
  }
}
