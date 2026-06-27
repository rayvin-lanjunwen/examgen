# ExamGen

从 Markdown / TXT 一键生成可离线使用的 HTML 网页试卷。

## 功能特性

- **双格式支持** — Markdown DSL（`#区块标记`）和 TXT 结构化标签（`<question>` 树形语法），两种输入格式
- **Markdown 驱动** — 用纯文本编写试卷，专用 `#区块标记` 语法清晰直观
- **五种题型** — 单选、多选、判断、填空、简答，全覆盖
- **数学公式** — 支持 LaTeX（`$...$` / `$$...$$`），由 KaTeX 渲染
- **富文本** — 题干/解析/答案支持 Markdown 表格、代码、图片等
- **完全离线** — 生成的 HTML 内联了所有 CSS / JS，无需联网即可作答
- **自动判分** — 提交后即时判分、高亮正误、显示正确答案和解析
- **侧边栏汇总** — 总分 + 各题型正确数 (X/X)，逐题对/错/待评状态
- **简答批阅** — 内置批阅面板，关键词半自动建议分，人工调整 + 上一题/下一题
- **倒计时** — 设置考试时间后自动倒计时，时间到自动交卷
- **答案保存** — 刷新或误关页面不丢答案（localStorage 自动保存）
- **键盘快捷键** — 数字键 1-4 选 ABCD、Tab 跳题、Enter 提交
- **题目标记** — 侧边栏 ☆ 标记待复查，书签保留到成绩复盘
- **成绩单打印** — 一键打印含得分明细 + 总分 + 及格状态的成绩单
- **随机化** — 按分区内乱序（保持单选→多选→判断的顺序），选项打乱自动同步答案
- **手机端适配** — 汉堡菜单 + 侧栏滑入覆盖 + 顶部固定操作栏 + 批阅底部 Sheet + 左右滑动切题
- **结构化错误提示** — 上传文件格式不对时，精确指出字段名和修复建议
- **命令行 + Web** — CLI 一条命令出卷，Web 界面拖拽上传更方便

## 安装

```bash
git clone https://github.com/rayvin-lanjunwen/examgen.git
cd examgen
pip install -e .
```

安装开发依赖（运行测试）：

```bash
pip install -e ".[dev]"
```

## 快速开始

### 1. 编写 Markdown 试卷

```markdown
---
title: Python 基础测验
subject: 计算机科学
time: 30
total_score: 20
default_score: 1
passing_score: 12
---

#1. [单选]
#题干
下列哪个是 Python 的关键字？
#选项
- A. class
- B. Class
- C. CLASS
- D. classify
#答案
A
#分值
2
#解析
`class` 是 Python 保留关键字，用于定义类。

#2. [判断]
#题干
Python 中 `None` 表示空值。
#答案
A
#分值
2

#3. [填空]
#题干
Python 中输出到控制台的内置函数是 `____`。
#答案
print
#分值
2
```

> 完整规范见 [docs/spec.md](docs/spec.md)，示例模板见 [docs/sample.md](docs/sample.md)。

### 2. 生成 HTML

```bash
examgen generate quiz.md -o quiz.html
```

### 3. 打开浏览器作答

双击 `quiz.html` 即可答题、提交、查看分数和解析。

### 命令行选项

```
examgen generate [OPTIONS] INPUT

Options:
  -o, --output PATH          输出 HTML 文件路径  [default: exam.html]
  --shuffle / --no-shuffle   覆盖：随机打乱题目顺序
  --option-shuffle / --no-option-shuffle
                             覆盖：随机打乱选项顺序
  --time INTEGER             覆盖：考试时间（分钟）
  --template-dir PATH        自定义模板目录
  --version                  显示版本号
  --help                     显示帮助信息
```

## Web 可视化界面

内置基于 FastAPI 的 Web 界面，拖拽上传 `.md` 文件即可生成试卷。**格式错误时会显示具体的字段名和修复建议。**

### 启动

```bash
examgen web
```

默认监听 `http://127.0.0.1:8080`，可通过 `--host` 和 `--port` 自定义：

```bash
examgen web --host 0.0.0.0 --port 3000 --reload
```

### 使用

1. 浏览器访问 http://localhost:8080
2. 点击 "规范说明""出卷提示词""示例模板" 下载参考文档
3. 拖拽 `.md` 试卷文件到上传区域，或点击选择文件
4. 可选：展开"可选参数"设置标题覆盖、考试时间、打乱选项等
5. 点击 **"生成并下载试卷"**
6. 浏览器自动下载生成的 HTML 试卷文件，双击即可作答

### 部署到 Vercel

项目根目录已包含 `vercel.json`，直接将仓库导入 Vercel 即可部署。

## YAML 元数据

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | **是** | 试卷标题 |
| `subject` | string | 否 | 科目（注意：不是 `course`） |
| `time` | int | 否 | 考试时长（分钟），必须是纯数字如 `90`，不能带单位 |
| `total_score` | float | 否 | 试卷总分（注意：不是 `score`） |
| `default_score` | float | 否 | 未指定分值时的默认分（默认 `1.0`），**建议填写** |
| `shuffle` | bool | 否 | 在每个 `## 分区` 内随机打乱题目顺序，保持分区之间顺序（默认 `false`） |
| `option_shuffle` | bool | 否 | 随机打乱选项顺序，答案字母自动映射（默认 `false`） |
| `passing_score` | float | 否 | 及格分，**建议填写**（如 `60`） |

> 常见错误：`course` → `subject`、`score` → `total_score`、`time: 90分钟` → `time: 90`。上传时若字段错误，解析器会给出具体提示。

## 题目格式

每道题使用 `#` 区块标记声明内容区块，支持新旧两种格式：

| 标记 | 含义 | 说明 |
|------|------|------|
| `#题干` | 题目主干 | **必填**，支持 Markdown、LaTeX 公式 |
| `#图片` | 配图 | 可选，`![描述](URL)` |
| `#表格` | 数据表格 | 可选，GFM 表格语法 |
| `#选项` | 选项 | 选择/判断题必填，`- A. xxx` 四行连续 |
| `#答案` | 参考答案 | **必填** |
| `#分值` | 分值 | 可选，不填则用 `default_score` |
| `#解析` | 题目解析 | 可选，提交后展示 |

```
#1. [单选]
#题干
问题描述
#选项
- A. 选项A
- B. 选项B
- C. 选项C
- D. 选项D
#答案
A
#分值
2
#解析
详细解析...
```

### 题型标识

| 标识 | 题型 | 判分方式 |
|------|------|----------|
| `[单选]` | 单选题 | 自动判分 |
| `[多选]` | 多选题 | 自动判分，支持 `A,B,D` 或 `ABD` |
| `[判断]` | 判断题 | 自动判分，A=正确 / B=错误，选项可省略 |
| `[填空]` | 填空题 | 自动判分，多空用 `____`，答案 `|` 分隔，多答案答对一个即算对 |
| `[简答]` | 简答题 | 关键词半自动建议分（需在解析中标注关键词），手动批阅调整 |

### 数学公式

使用标准 LaTeX 语法，在线环境由 KaTeX 渲染：

```markdown
#题干
函数 $f(x) = \sum_{i=1}^{n} x_i^2$ 在 $x=0$ 处取得最小值。

#解析
$$
\frac{\partial f}{\partial x_i} = 2x_i = 0 \implies x_i = 0
$$
```

## 出卷参考

- **格式规范（Markdown）**：[docs/spec.md](docs/spec.md) — Markdown DSL 格式标准 + 常见错误排查
- **格式规范（TXT）**：[docs/spec-txt.txt](docs/spec-txt.txt) — TXT 结构化标签格式标准 + 常见错误排查
- **出卷提示词（Markdown）**：[docs/prompt.md](docs/prompt.md) — 提供给 AI 的 Markdown 出卷要求模板
- **出卷提示词（TXT）**：[docs/prompt-txt.txt](docs/prompt-txt.txt) — 提供给 AI 的 TXT 格式出卷要求模板
- **示例模板（Markdown）**：[docs/sample.md](docs/sample.md) — Markdown 格式示范文件
- **示例模板（TXT）**：[docs/sample-txt.txt](docs/sample-txt.txt) — TXT 格式示范文件

## 开发指南

### 项目结构

```
examgen/
├── pyproject.toml
├── vercel.json                          # Vercel 部署配置
├── api/
│   └── index.py                        # Vercel Serverless 入口
├── src/examgen/
│   ├── __init__.py
│   ├── cli.py                          # Click CLI 入口
│   ├── models.py                       # 数据模型 (ExamMeta, Question, Option)
│   ├── core/
│   │   ├── parser.py                   # Markdown 解析 → 数据模型（含 ParseError）
│   │   ├── parser_txt.py               # TXT 结构化格式解析 → 数据模型
│   │   ├── normalizer.py               # 校验、补全分值/选项/答案规范化
│   │   ├── transformer.py              # 题目 / 选项随机化
│   │   └── generator.py                # Jinja2 渲染 → 独立 HTML
│   ├── web/
│   │   ├── app.py                      # FastAPI Web 应用（返回结构化错误）
│   │   ├── templates/upload.html       # 上传页面
│   │   └── static/style.css            # Web 界面样式
│   └── templates/default/
│       ├── exam.html                   # Jinja2 试卷模板
│       └── assets/
│           ├── style.css               # 试卷样式（内联）
│           └── js/
│               ├── 01_constants.js     # 常量定义
│               ├── 02_utils.js         # HTML 转义、Markdown 渲染（公式保护）
│               ├── 03_nav.js           # 侧边导航 + 对错状态
│               ├── 04_render.js        # 题目渲染（含公式保护）
│               ├── 05_scoring.js       # 判分、高亮、答案展示
│               ├── 06_countdown.js     # 倒计时 + 自动交卷
│               ├── 07_init.js          # 页面初始化、localStorage、键盘快捷键
│               ├── 08_grading.js       # 简答题批阅（关键词判分 + 翻题）
│               └── 09_bookmarks.js     # 题目标记/收藏系统
├── tests/
│   ├── test_parser.py                # 含公式保留、ParseError 测试
│   ├── test_normalizer.py
│   ├── test_transformer.py
│   └── test_generator.py
└── docs/
    ├── spec.md                       # 题目源文件规范（Markdown）
    ├── spec-txt.txt                  # 题目源文件规范（TXT）
    ├── prompt.md                     # AI 出卷提示词（Markdown）
    ├── prompt-txt.txt                # AI 出卷提示词（TXT）
    ├── sample.md                     # 示例模板（Markdown）
    └── sample-txt.txt                # 示例模板（TXT）
```

### 运行测试

```bash
pytest tests/ -v
```

### 处理流程

```
Markdown (.md)
  │
  ▼ parser.py ───────→ 预检 YAML → 切分区块 → ExamMeta + List[Question]
  │                    （字段错误时抛出 ParseError，精确指错）
  │
TXT (.txt)
  │
  ▼ parser_txt.py ──→ 移除注释 → 提取标签 → ExamMeta + List[Question]
  │                    （与 .md 输出相同的模型对象）
  │
  ▼ normalizer.py ───→ 分值补全 / 选项补全 / 答案大写 / 格式校验
  │
  ▼ transformer.py ──→ 题目打乱 / 选项打乱（答案映射同步）
  │
  ▼ generator.py ───→ Jinja2 渲染 + CSS/JS 内联 → 独立 HTML
  │
  ▼ save_exam ──────→ 写入文件
```

## 开源协议

[MIT License](LICENSE)
