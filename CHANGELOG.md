# 更新日志

---

## 2026-06-29 (凌晨续)

### Tauri 桌面版

新增完整的 Tauri 桌面端打包工程：

- **Rust 主程序** — `desktop/src-tauri/src/main.rs`，启动 FastAPI sidecar + 创建 WebView 窗口（1100×780）
- **Sidecar 模式** — 发布版自动扫描多路径查找 `examgen-server.exe`，开发版直接调用 `python -m uvicorn`
- **复用 Web 界面** — `desktop/public/index.html` 仅做 iframe 加载，上传/生成/下载/预览全部复用现有页面
- **一键构建** — `desktop/build_release.py`（PyInstaller → npm install → tauri build）
- **输出 .msi** — Tauri v2 bundle 生成 Windows 安装包，用户双击安装，**无需 Python/Node.js/Rust**
- **Web 端 .exe 下载入口** — 上传页面顶部新增桌面版下载 banner
- **pyproject.toml 配置** — 新增 `[tool.examgen.desktop]` 段记录构建参数

### 文档
- `desktop/README.md` 完整构建/分发说明
- `.gitignore` 排除 Tauri 构建产物

---

## 2026-06-29 (凌晨)

### Bug 修复（闯关模式）

- **提交后解析不显示** — `renderQuestions` 切题时用 `exp.style.display = "none"` 清空了解析区，内联样式优先级高于 CSS class `.show`，导致后续 `className = "explanation show"` 无效。修复：改用 `exp.className = ""` 控制显隐
- **`highlightResult` 与 `showChallengeFeedback` 双重显示** — 提交后题卡内出现冗余 `.answer-display` 与 `#challenge-feedback` 两个正确答案行，让人误以为解析区显示的是答案。修复：提交后主动移除 `.answer-display`，统一由 challenge-feedback 展示
- **选择题提交后解析不显现** — 回退早期 `showChallengeFeedback` 中简答题的 `return` 逻辑，改为 `if/else if/else` 衔接确保解析区对所有题型都渲染
- **考试模式只显示第一题** — `10_challenge.js` 覆盖了 `renderQuestions` 等核心函数，考试模式中误打包该文件。修复：`generator.py` 考试模式 skip `10_challenge.js`
- **旧数据残留** — 同一标题的试卷重新生成后刷新，localStorage 旧数据导致部分题显示为"已完成"。修复：初始化时清除 localStorage

### 样式增强

- **四套主题差异化** — 新增 `--font-body`/`--card-radius`/`--card-shadow`/`--card-border-left`/`--option-radius`/`--option-active-glow`/`--banner-angle`/`--sidebar-divider-style`/`--nav-badge-radius` 9 个主题级变量，card/option/font/shadow 四主题各不相同：
  - **modern**（现代）: 默认 sans-serif + 10px 圆角卡片
  - **academic**（学术）: Georgia 衬线体 + 6px 直角卡片 + dotted 分割线
  - **tool**（工具）: Inter 字体 + 2px 方角卡片 + 无阴影扁平风
  - **green**（环保）: 14px 圆角 + 绿调 shadow + 全圆选项

### 兼容性修复

- **`~` 被误解析为删除线** — marked.js GFM 将单个 `~`（数字范围如 125Kb/s~1Mb/s）误判为下标/删除线。修复在 `mdToHTML()` 中增加保护：`~~` 占位 → `~` 转 `&#126;` → 还原 `~~`

### 文档更新

- **prompt-txt.txt / prompt.md**: 明确填空题 `<explanation>` 是知识点解析，不是答案的重复
- **spec-txt.txt / spec.md**: 新增 `<explanation>` 和 `<answer>` 职责区别说明
- 解析要求表格细化：选择题必须错误选项分析，填空/简答侧重知识点背景

---

## 2026-06-28 (深夜)

### 闯关模式卡片化改造
- **单题大卡片布局** — `challenge-stage` 居中主区域（max-width: 780px），`challenge-card-wrap` 垂直居中撑满
- **答案反馈独立区** — `#challenge-feedback` + `#challenge-explanation` + `#challenge-reference` 在卡片下方固定区域
- **底部操作栏重构** — `challenge-bottombar` 三栏布局（◀上一题 | 第N题 提交 重做 | 下一题▶）
- **顶部信息简化** — 标题 + 科目/时间/分数行 + 进度条，去除考试模式横幅
- **按钮可见性修复** — `.btn-secondary` 改用 `--color-btn-secondary: #ffffff` + 2px 深色边框，不再和背景融色
- **闯关结束按钮样式** — `#end-btn` 改为暖黄色警告风格，悬停加深

### Bug 修复
- **JS 致命错误链** — `saveAnswersToStorage`/`onSubmit`/`retryBtn`/`endBtn` 等 07_init.js 中定义的符号在闯关模式中不存在，导致脚本全盘不执行。全部在 `10_challenge.js` 中自备定义
- **`findExamData`/`reRenderMath` 缺失** — 从 08_grading.js 移植到 challenge.js，修复所有跳题/渲染调用
- **书签星标刷到卡片** — `challengeGoTo` 和初始化末尾重新调用 `initBookmarks()`
- **提交后同时显示答案和解析** — `showChallengeFeedback` 正确时也显示"标准答案"，并同时展开解析区

### 改进
- 收藏星标颜色提升可见度：`var(--color-text-tertiary)` → `#c4b5fd`
- 收藏星标加 `font-size: 0` 消除额外间隙

---

## 2026-06-28 (晚间)

### 闯关模式

新增第二种试卷交互模式——**闯关模式**，与原有考试模式并行：

- **逐题作答** — 每道题单独在屏幕上显示，作答完当前题后手动跳转到下一题
- **即时判分** — 每道题提交后立刻判断正误并显示正确答案和解析，实现即时反馈学习
- **自由跳转** — 侧边导航栏保留，可随时跳转到任意题
- **可重做** — 已判分的题可以重做，清空之前的判分结果
- **简答题** — 不自动判分，提交后仅显示参考答案供自行对比
- **闯关进度条** — 横幅下方显示已判分/总题数进度
- **遍历导航** — 上一题/下一题按钮 + 左右箭头键盘快捷键

**实现**：
- 新增 `templates/default/challenge.html` — 闯关模式独立模板（单题渲染 + 进度条 + 遍历导航）
- 新增 `assets/challenge.css` — 闯关模式增量样式（大卡片、进度条、反馈卡片）
- 新增 `assets/js/10_challenge.js` — 闯关模式全部交互逻辑（≈750 行）
- `generator.py` — `generate_html()` 新增 `mode` 参数，按模式分流模板和 JS 模块
- `cli.py` — 新增 `--mode [exam|challenge]` 命令行选项
- Web 上传页 — 新增「试卷模式」选择卡片（考试模式 / 闯关模式）
- Web API — `/generate` 接受 `mode` form 参数

### Bug 修复（15 项）

- **default_score 完全被忽略** — `parser.py` 在解析时硬编码 `score=1.0`，使 `meta.default_score` 从未生效。修复为传 `None` 交 normalizer 处理
- **填空题空答案收集缺陷** — `answers[fqid]` 为 `""` 时 falsy 导致 "|" 分隔符跳过，空答案丢失
- **多空填空单答判对** — 只填一个空就判整题正确，修正为单空才宽松匹配
- **重复选项内容映射错误** — 选项打乱时 `text→label` 反向字典在内容相同时丢 key，改为 `(label, text)` 对直接打乱
- **marked.setOptions 已废弃** — CDN 加载 marked@15，`setOptions` 在 v5+ 已废弃，改为 `marked.parse(text, opts)` + 旧版回退
- **倒计时条外层残留在无时限考试** — `timerBar` (inner) 隐藏但外层 `#timerBar` 容器仍占 4px，新增 `timerBarOuter` 一起隐藏
- **TXT `<math>` 块级公式在 topic 内不处理** — `_process_text` 只处理 `<inline-math>`，新增 `<math>` → `$$...$$`
- **onGradingDone 覆盖原始分值** — `r.score` 语义从"满分"变成"得分"，改为 `_userScore` 分离两种语义
- **关键词只支持单行** — `scoreEssayByKeywords` 正则 `/.+/` 不跨行，改为 `/[\s\S]+?/`
- **成绩报告简答得分算"正确"** — `gradingScores[id] > 0` 就计正确，改为按实际得分/满分显示
- **FastAPI on_event("startup") 废弃** — 改为 `lifespan` 上下文管理器
- **旧格式多行字段被截断** — `_extract_multiline_field` 遇到内容中的 `答案：` 就截断，增加 `#标记`/`##分区`/`#N.` 边界检测
- **图片嵌入失败静默** — `_embed_local_images` 失败时无任何提示，新增 `logging.warning` 日志
- **normalizer 不校验填空/简答答案** — 新增空答案校验
- **选项圆圈硬编码 A/B/C/D** — 选项 > 4 个时显示不一致，统一为 `opt.label`

### 侧边导航栏调整

- **宽度缩减** — `--sidebar-width` 从 240px → 192px
- **布局优化** — `nav-done` (已答图标) 居中，`nav-bookmark` (收藏星) 靠右紧跟题号
- **页面始终居中** — `main-content` 使用 `flex + justify-content: center`，无论侧栏展开/折叠都居中
- **题号包裹** — `q.id` 改为 `<span class="nav-qid">`，flex gap 正确生效
- **折叠选择器修复** — `.sidebar.collapsed + .main-content` → `~`，因 sidebar-expand-btn 挡在中间

### CSS 变量与主题完善

- **缺失变量补全** — `--color-text-tertiary`、`--radius-xs`、`--timer-bar-bg`、`--color-hover` 添加到 `:root` 及 4 个主题
- **硬编码色值变量化** — `.timer-bar`、`.option-label:hover`、`.essay-textarea`、`.review-item:hover`、`.score-ring` filter、SVG `#ringGrad` 全部改用 CSS 变量
- **书签星标样式冲突清理** — 两段重复定义合并为单一完整块
- **移动端伪元素修复** — `.option-circle::after` 无效伪元素移除，圆尺寸 22px→28px
- **KaTeX 公式溢出** — `.katex-display` 新增 `-webkit-overflow-scrolling` + 美化滚动条

### 三步引导图标

- 上传页三步引导的数字 `1/2/3` 替换为 SVG 图标：✎ 编辑笔 / ↥ 上传箭头 / ↧ 下载箭头

### 清理

- 删除 `tmp_test/`、`.pytest_cache/`、`examgen.egg-info/`、`.venv/`、`.agents/` 等临时/废弃目录

---

## 2026-06-28

### 试卷生成主题系统
- **4 套视觉风格**：现代教育（紫色）、学术纸本（暖纸色）、专业工具（天蓝色）、碧绿清新（翠绿色）
- **上传页可选**：在「可选参数」面板选择试卷风格，生成的离线 HTML 试卷以对应风格渲染
- **CSS 变量驱动**：4 套 `body[data-theme]` 变量覆盖，覆盖主色、背景、渐变、边框等全部视觉维度
- **后端贯通**：`generator.py` 新增 `theme` 参数，`/generate` API 接受 `style` form 参数

### 上传页面视觉重塑
- **定制 SVG 品牌标识**：紫色渐变圆角方块 + 文档线条 + 对勾，替代原 emoji 图标
- **背景圆点网格**：24px 间距圆点 + 径向透明度渐变，增加层次感
- **毛玻璃卡片**：`backdrop-filter: blur(16px)`，悬浮时透明度变化
- **错落入场动画**：步骤条、卡片、页脚依次 `fadeInUp` 弹入
- **标题渐变色**：`background-clip: text` 实现主色渐变文字

### 上传流程优化
- **渐进式引导**：6 个文档链接合并为 2 个「Markdown / TXT」下拉按钮，减少首屏信息密度
- **拖拽区就绪状态**：文件上传后拖拽区缩小为绿色摘要条，显示「文件已添加」
- **参数面板自动展开**：上传第一个文件后自动展开参数，无需手动点击
- **流程提示文字**：上传后出现「文件已就绪」引导文字

### 参数面板精简
- **删除冗余字段**：移除「试卷标题覆盖」和「考试时间（分钟）」— 这些由源文件定义
- **Toggle 开关替换 Checkbox**：「随机打乱题目顺序」「随机打乱选项顺序」改为 iOS 风格开关
- **风格选择器增强**：圆点悬停放大 + 选中外发光

### Internal
- `generator.py`：`generate_html()` 新增 `theme: str = "modern"` 参数
- `web/app.py`：`/generate` 接受 `style` form 参数并传递
- `exam.html`：`<body data-theme="{{ theme }}">`
- `assets/style.css`：新增 4 套 `body[data-theme="xxx"]` CSS 变量覆盖 + 渐变变量
- `web/static/style.css`：简化回单一主题，新增资源下拉、Toggle 开关、毛玻璃等组件样式
- `web/templates/upload.html`：全流程逻辑重写（资源下拉 + 自动展开 + 就绪状态）

---

## 2026-06-27

### TXT 结构化格式支持

新增纯文本结构化标签格式（`.txt`），与原有 Markdown DSL 格式并行，共用同一套渲染和判分引擎。

- **新增 TXT 格式** — 封闭标签语法，`<meta> / <question>` 树形结构，零 Markdown 语法冲突
- **核心标签** — `<title>` `<topic>` `<type>` `<options>` `<answer>` `<explanation>` `<keywords>`
- **资源标签** — `<image>` 图片、`<table>` GFM 表格、`<math>` 块级 LaTeX 公式、`<inline-math>` 行内 LaTeX 公式（可嵌套在文本/表格中）
- **选项分离** — `<option>` 内拆分为 `<label>A</label>` + `<text>内容</text>`，label 和文本彻底解耦
- **解析器** — 新增 `src/examgen/core/parser_txt.py`，输出与原有 parser 完全一致的 `ExamMeta + List[Question]`，直接对接现有 `normalize → transform → generate_html` 管线
- **Web 端支持** — `/generate` 接口自动识别 `.md` / `.txt` 文件并分流，两种格式不能混传
- **前端适配** — 上传区 accept 属性加 `.txt`，文件列表统一识别 `.md/.markdown/.txt` 为试卷文件
- **转义规则** — `<topic>/<text>/<explanation>` 内 `<` `>` 须转义为 `&lt;` `&gt;`；`<math>/<inline-math>` 内不需要
- **注释支持** — `<!-- -->` 格式注释，放在标签外部
- **标签顺序无关** — 解析器按标签名匹配，不按出现位置

### 文档

- **新增** `docs/spec-txt.txt` — TXT 结构化格式完整规范（15 个标签定义 + 8 条错误排查）
- **新增** `docs/prompt-txt.txt` — 面向 AI 的 TXT 格式出卷提示词
- **新增** `docs/sample-txt.txt` — TXT 格式完整示例（9 题，5 种题型全覆盖）
- **更新** `README.md` — 补充 TXT 格式说明
- **更新** `CHANGELOG.md` — 添加本次更新记录
- **修复** `.gitignore` — 添加 `!docs/*-txt.txt` 例外规则

---

## 2026-06-25 11:30

### 图片嵌入 & LaTeX 大小写强化
- **Web 端多文件上传** — 支持同时选择 `.md` + 图片文件，后端按**文件名**自动匹配嵌入 base64，无需关心目录路径
- **前端文件列表** — 上传区区分 `.md`（蓝色左边框）和图片（绿色左边框），支持拖拽和多选
- **修复选项图片不渲染** — `04_render.js` 中选项文本改用 `innerHTML` + `mdToHTML()` 渲染，`style.css` 新增 `img` 自适应样式
- **LaTeX 大小写致命警告** — `spec.md`、`prompt.md`、`sample.md` 三文档同步强化：blockquote 醒目警告 + 8 组错误/正确对照（`\FRAC`→`\frac`、`\TIMES`→`\times` 等）
- **错误排查表扩充** — `spec.md` 新增第 12/13/14 条：图片未上传、图片名不匹配、公式大写不渲染
- **工具脚本** — 新增 `scripts/embed_images.py`，支持将本地图片一键转为 base64 嵌入 `.md`

---

## 2026-06-25 01:30

- **删除打印成绩单** — 移除独立打印页面（`#printReport` 元素 + `@media print` 样式 + `fillPrintReport`/`addPrintBtn` 函数）
- **LaTeX 命令规则** — `docs/prompt.md` 和 `docs/spec.md` 补充：LaTeX 命令必须小写（`\times` 而非 `\TIMES`）

---

## 2026-06-24 22:00

### 重构：三文档职责分离
- **职责划分** — `docs/spec.md`（纯格式规范）、`docs/prompt.md`（纯 AI 任务书）、`docs/sample.md`（纯可复制模板），消除三者之间的规则交叉和重复
- **统一报错** — `normalizer.py` 的 `ValueError` 全部改为 `ParseError`（带 `field`/`suggestion`），Web 端所有报错均按三行式展示
- **路径清理** — 删除 `tests/fixtures/sample.md`，测试和 Web 路由统一指向 `docs/sample.md`

---

## 2026-06-24 20:00

### 修复 & 增强
- **成绩页重排** — 顺序改为：总分大字 → 通过/未通过 → 正确率环形图 → 题型汇总条 → 逐题列表
- **手机端批阅按钮** — 批阅模式顶部"交卷"自动切换为"完成批阅"，重置后恢复
- **公式渲染修补** — `showFinalScore` 和 `onGradingDone` 末尾调用 `reRenderMath()`，确保解析/答案中 LaTeX 正确渲染
- **未答题提示时机** — 只在答题界面显示，进入批阅后自动隐藏
- **批阅重置按钮修复** — `cloneNode` 替换改为 `gradingActive` 模式感知，重置后绑定正确路径
- **焦点缓存过期** — 手动滚动后 `_currentFocusQid` 置空，键盘快捷键重新计算当前题
- **题型条空态保护** — `fillScoreTypeSummary` 无数据时不显示
- **480px 小屏字体紧凑** — 总分 `1.3rem`、环形 `1rem`、复盘项进一步缩小
- **Web 端三个文档可下载** — 首页新增"规范说明""出卷提示词""示例模板"下载按钮

---

## 2026-06-24 18:00

### 手机端适配（全部）
- **汉堡菜单** — 左上角 `☰` 按钮 + 半透明遮罩，侧栏滑入覆盖模式
- **顶部固定操作栏** — 计时条下方：汉堡 + 进度 + 交卷按钮
- **批阅底部 Sheet** — 批阅面板改为底部滑入卡片，含分值按钮 + ◀▶ 翻题
- **成绩纵向卡片流** — 环形图缩小至 90px，复盘列表全宽
- **左右滑动切题** — 水平滑动 > 60px 自动跳上一题/下一题
- **导航栏折叠恢复按钮** — 桌面端收起后左侧边缘出现 `▶` 按钮
- **全面积大小适配** — 横幅/题卡/选项/输入/成绩区/批阅栏在 900px/480px 两档响应

---

## 2026-06-24 15:00

### 提交 & 打印体验
- **未答题提示整合到侧栏** — 提交时未答题以红色标签显示在导航栏进度条下方，点击可跳转
- **导航栏折叠** — 侧栏标题右侧 `◀` 按钮，折叠/展开

### 判分
- **分区内乱序** — `shuffle` 改为在每个 `## 分区` 内独立打乱，保持分区之间的顺序
- **简答关键词半自动判分** — 解析中 `关键词：A, B, C` 行按匹配比例给建议分
- **答案放在解析之前** — 提交后正确答案显示在解析上方
- **答案公式渲染** — 答案中的 LaTeX 公式正确渲染，不再被 `escapeHTML` 破坏
- **填空多答案容错** — 单个空多个可接受答案（`|` 分隔），答对一个即判对

### 答题体验
- **localStorage 答案保存** — 刷新/误关页面不丢答案，包括书签状态
- **键盘快捷键** — `1-4` 选 ABCD / `Tab` 跳题 / `Enter` 提交
- **题目标记（书签）** — 侧边栏 `☆` + 题卡分值旁 `☆`，点击变 `★`，保留到成绩复盘
- **导航栏结果汇总** — 提交后侧边栏显示总分 + 各题型正确数

### 批阅
- **批阅翻题按钮** — 右面板 `◀ 上一题 / 下一题 ▶`
- **分值按钮即点即选** — 点击直接选中亮高

### 文档 & 规范
- `CHANGELOG.md` — 新建
- `docs/spec.md` — YAML 常见错误表、填空多答案规则、简答关键词说明
- `docs/prompt.md` — 出卷提示词模板
- `README.md` — 重写功能特性列表（16 项）

### 错误反馈
- **ParseError 结构化异常** — 每个错误带 `message`/`field`/`suggestion` 三字段
- **Web 端 JSON 错误返回** — `/generate` 接口分三行展示

---

## 2026-06-23

### 答题体验
- **公式渲染修复** — `mdToHTML` 先保护 `$...$` / `$$...$$` 占位，避免 `_` `*` 被 marked 破坏
- **填空题公式保护** — `**` 占位符替换时不破坏公式内的指数符号
- **答案直观展示** — 每道题卡片底部显示绿色 `✓` / 红色 `✗`
- **导航栏对错状态** — 左侧栏逐题显示 `✓` / `✗` / `?`

### 解析器
- **`_strip_leading_backslash` 智能检测** — 仅剥离 AI 转义 `\[选项\]`，不破坏 LaTeX `\[\frac{a}{b}\]`
- **YAML 字段名校验** — `course`、`score` 等预检报错

### 文档
- `docs/spec.md` — 正式版本，11 条铁律 + 题型格式 + 富文本 + 错误排查
- `tests/fixtures/sample.md` — 标准示例模板

---

## 2026-06-22

### 架构
- **完整重构** — 新区块标记语法（`#题干` `#选项` `#答案` `#解析` `#分值` `#图片` `#表格`）
- **JS 模块化** — `01_constants` → `07_init`
- **侧边栏** — 导航/进度条/当前题目高亮
- **UI 美化** — 渐变横幅、彩色题型标签、圆形选项按钮

### 核心功能
- **解析器** — YAML front matter + `#` 区块标记 + 新旧格式兼容
- **五种题型** — 单选/多选/判断/填空/简答
- **自动判分** — 即时判分、高亮正误
- **倒计时** — 顶部进度条 + 悬浮气泡 + 到时自动交卷
- **随机化** — 题目/选项乱序（答案映射自动同步）
- **Web UI** — FastAPI + 拖拽上传 + 一键下载
- **CDN 兜底** — KaTeX/marked 加载失败降级提示

---

## 更早

- **腾讯云 SCF 部署** — Vercel + 腾讯云双线部署
- **项目初始化** — 基础 CLI 工具 + Jinja2 模板渲染
