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

var TYPE_ABBR = {};
TYPE_ABBR[QT.SINGLE]   = "单选";
TYPE_ABBR[QT.MULTIPLE] = "多选";
TYPE_ABBR[QT.JUDGE]    = "判断";
TYPE_ABBR[QT.FILL]     = "填空";
TYPE_ABBR[QT.ESSAY]    = "简答";

/* ── DOM 引用 ────────────────────────────────────────── */
var container = document.getElementById("questions-container");
var navList    = document.getElementById("navList");
var submitBtn  = document.getElementById("submit-btn");
var resetBtn   = document.getElementById("reset-btn");
var scoreArea  = document.getElementById("score-area");
var scoreDisp  = document.getElementById("score-display");
var passStatus = document.getElementById("pass-status");
var progressFill = document.getElementById("progressFill");
var progressText = document.getElementById("progressText");
var reviewList = document.getElementById("reviewList");
var timerBar   = document.getElementById("timerBarInner");
var timerBubble = document.getElementById("timerBubble");
var bubbleFill = document.getElementById("bubbleFill");
var bubbleText = document.getElementById("bubbleText");
