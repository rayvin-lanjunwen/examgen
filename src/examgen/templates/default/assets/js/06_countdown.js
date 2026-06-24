/* ── 倒计时（顶部条 + 悬浮气泡 + 横幅倒计时） ─────── */
var countdownTimer = null;
var countdownDeadline = 0;   // 绝对截止时间（ms），用于抵抗浏览器后台节流
var totalTimeSec = 0;

function startCountdown(totalSeconds) {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownDeadline = Date.now() + totalSeconds * 1000;
  totalTimeSec = totalSeconds;
  var el = document.getElementById("countdown");
  if (timerBar) timerBar.style.display = "block";

  function tick() {
    var remaining = Math.max(0, Math.ceil((countdownDeadline - Date.now()) / 1000));
    var m = Math.floor(remaining / 60);
    var s = remaining % 60;
    var display = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    if (el) el.textContent = display;

    // 顶部计时条
    if (timerBar) {
      var barPct = Math.min(100, (remaining / totalTimeSec * 100)).toFixed(1);
      timerBar.style.width = barPct + "%";
      if (remaining <= 300) timerBar.classList.add("urgent");
      else timerBar.classList.remove("urgent");
    }

    // 悬浮气泡（最后5分钟显示）
    if (remaining <= 300 && remaining > 0 && timerBubble) {
      timerBubble.classList.remove("hidden");
      if (bubbleText) bubbleText.textContent = display;
      if (bubbleFill) {
        var bubbleMax = Math.min(totalTimeSec, 300);
        var bubbleRemaining = remaining;
        var bubblePct = bubbleRemaining / bubbleMax;
        var circumference = 2 * Math.PI * 36; // ≈ 226.2
        bubbleFill.setAttribute("stroke-dasharray", (circumference * bubblePct).toFixed(1) + " " + circumference);
      }
      if (remaining <= 60) timerBubble.classList.add("flash");
      else timerBubble.classList.remove("flash");
    } else if (timerBubble) {
      timerBubble.classList.add("hidden");
    }

    if (remaining <= 0) {
      clearInterval(countdownTimer);
      if (el) el.textContent = "时间到！";
      if (timerBubble) timerBubble.classList.add("hidden");
      onSubmit();
    }
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}
