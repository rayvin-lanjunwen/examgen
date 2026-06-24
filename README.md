# ExamGen

从 Markdown 一键生成可离线使用的 HTML 网页试卷。

## 功能特性

- **Markdown 驱动** — 用纯文本编写试卷，支持 YAML front matter 元数据
- **五种题型** — 单选、多选、判断、填空、简答，全覆盖
- **完全离线** — 生成的 HTML 文件内联了所有 CSS / JS，无需联网即可作答
- **自动判分** — 提交后即时判分、高亮正误、显示解析
- **倒计时** — 设置考试时间后自动生成倒计时，到时自动交卷
- **随机化** — 支持题目顺序打乱、选项顺序打乱（答案映射自动同步）
- **命令行工具** — 一条命令完成从 `.md` 到 `.html` 的全流程
- **打印友好** — CSS `@media print` 优化，隐藏按钮、显示答案解析

## 安装

### 从源码安装（推荐开发时使用）

```bash
git clone <your-repo-url>
cd 试卷生成器
pip install -e .
```

### 安装开发依赖

```bash
pip install -e ".[dev]"
```

## 快速开始

### 1. 准备 Markdown 试卷文件

创建一个 `.md` 文件，顶部用 YAML front matter 声明试卷元数据，正文按规范编写题目。

示例（`quiz.md`）：

```markdown
---
title: Python 基础测验
subject: 计算机科学
time: 30
total_score: 20
passing_score: 12
---

1. [单选] 下列哪个是 Python 的关键字？
- A. class
- B. Class
- C. CLASS
- D. classify
答案：A
分值：2
解析：class 是 Python 的保留关键字。

2. [判断] Python 中 None 表示空值。
答案：A
分值：2

3. [填空] Python 中用于输出到控制台的内置函数是 ____。
答案：print
分值：2
```

完整的题目源文件规范见 [docs/spec.md](docs/spec.md)。

### 2. 生成 HTML

```bash
examgen generate quiz.md -o quiz.html
```

### 3. 打开浏览器作答

双击 `quiz.html` 即可在浏览器中答题、提交、查看分数。

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

## 可视化界面

ExamGen 内置了基于 FastAPI 的 Web 界面，无需记忆命令行参数，拖拽上传即可生成试卷。

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
2. 拖拽 `.md` 试卷文件到上传区域，或点击选择文件
3. 可选：展开"可选参数"设置标题覆盖、考试时间、打乱选项等
4. 点击 **"生成并下载试卷"**
5. 浏览器自动下载生成的 HTML 试卷文件，双击即可作答

<!-- 截图占位：上传页面和生成结果示意图 -->

## 题目源文件规范

### Front Matter（元数据）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 试卷标题 |
| `subject` | string | 否 | 科目 |
| `time` | int | 否 | 考试时间（分钟） |
| `total_score` | float | 否 | 总分 |
| `default_score` | float | 否 | 题目默认分值（默认 1.0） |
| `shuffle` | bool | 否 | 是否随机打乱题目顺序 |
| `option_shuffle` | bool | 否 | 是否随机打乱选项顺序 |
| `passing_score` | float | 否 | 及格分 |

### 题目格式

- 题目之间用 **空行** 分隔
- 每道题第一行：`题号. [题型] 题干`
- 题型标识：`[单选]` / `[多选]` / `[判断]` / `[填空]` / `[简答]`
- 选项行：`- A. 选项内容`
- 答案行：`答案：A` 或 `答案：A,B,D`
- 分值行：`分值：2`
- 解析行：`解析：说明文字`（可选）

详细规范见 [docs/spec.md](docs/spec.md)。

## 开发指南

### 项目结构

```
examgen/
├── pyproject.toml                 # 项目配置、依赖、CLI 入口
├── src/examgen/
│   ├── __init__.py                # 版本号
│   ├── cli.py                     # Click CLI 入口
│   ├── models.py                  # 数据类定义（Question, ExamMeta 等）
│   ├── core/
│   │   ├── parser.py              # 解析 Markdown → 数据模型
│   │   ├── normalizer.py          # 校验、补全缺失字段
│   │   ├── transformer.py         # 题目 / 选项随机化
│   │   └── generator.py           # Jinja2 渲染 → HTML
│   ├── web/
│   │   ├── app.py                 # FastAPI Web 应用
│   │   ├── templates/
│   │   │   └── upload.html        # 上传页面模板
│   │   └── static/
│   │       └── style.css          # Web 界面样式
│   └── templates/default/
│       ├── exam.html              # Jinja2 试卷模板
│       └── assets/
│           ├── style.css          # 试卷样式表（内联）
│           └── script.js          # 答题交互逻辑（内联）
├── tests/
│   ├── fixtures/sample.md         # 官方标准模板
│   ├── test_parser.py
│   ├── test_normalizer.py
│   ├── test_transformer.py
│   └── test_generator.py
└── docs/
    └── spec.md                    # 题目源文件规范
```

### 设置开发环境

```bash
# 克隆项目
git clone <your-repo-url>
cd 试卷生成器

# 创建虚拟环境（可选）
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# 安装（可编辑模式 + 开发依赖）
pip install -e ".[dev]"
```

### 运行测试

```bash
pytest tests/ -v
```

### 处理流程

```
Markdown (.md)
  │
  ▼ parser.py ───────→ ExamMeta + List[Question]
  │
  ▼ normalizer.py ───→ 校验、补全分值/选项
  │
  ▼ transformer.py ──→ 随机打乱题目/选项
  │
  ▼ generator.py ───→ Jinja2 渲染 → 独立 HTML
  │
  ▼ save_exam ──────→ 写入文件
```

## 开源协议

[MIT License](LICENSE)
