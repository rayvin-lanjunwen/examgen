# 题目源文件规范

ExamGen 使用 Markdown 文件作为试卷源文件，顶部通过 YAML front matter 声明元数据。

## 文件结构

```
---
元数据（YAML front matter）
---

题目正文（Markdown）
```

## Front Matter 元数据

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `title` | string | **是** | — | 试卷标题 |
| `subject` | string | 否 | `None` | 科目名称 |
| `time` | int | 否 | `None` | 考试时间（分钟），生成倒计时 |
| `total_score` | float | 否 | `None` | 总分（仅显示用） |
| `default_score` | float | 否 | `1.0` | 题目未指定分值时的默认分 |
| `shuffle` | bool | 否 | `false` | 是否随机打乱题目顺序 |
| `option_shuffle` | bool | 否 | `false` | 是否随机打乱选项顺序 |
| `passing_score` | float | 否 | `None` | 及格分（用于显示通过/未通过） |

### 示例

```yaml
---
title: 期末考试
subject: 计算机科学
time: 90
total_score: 100
default_score: 2
shuffle: false
option_shuffle: false
passing_score: 60
---
```

## 题目格式

### 基本规则

- 题目之间用 **一个或多个空行** 分隔
- 每道题第一行格式：`题号. [题型] 题干`
- 题号为连续整数，从 1 开始
- 支持的题型标识：`[单选]`、`[多选]`、`[判断]`、`[填空]`、`[简答]`

### 可选字段

每道题可包含以下可选行（顺序不限）：

- `答案：xxx`
- `分值：x`
- `解析：xxx`

### 题型详解

#### 单选题 `[单选]`

```markdown
1. [单选] 下列哪个是 Python 的关键字？
- A. class
- B. Class
- C. CLASS
- D. classify
答案：A
分值：2
解析：class 是 Python 的保留关键字。
```

- 选项以 `- 字母. 内容` 格式列出
- 答案为单个大写字母

#### 多选题 `[多选]`

```markdown
2. [多选] 以下哪些是合法的 Python 数据类型？
- A. list
- B. dict
- C. array
- D. tuple
答案：A,B,D
分值：3
```

- 答案为多个大写字母，可用逗号分隔（`A,B,D` 或 `ABD` 均可）

#### 判断题 `[判断]`

```markdown
3. [判断] Python 中 None 表示空值。
答案：A
分值：2
```

- 答案 `A` 表示正确，`B` 表示错误
- 选项可以省略（normalizer 会自动添加 `A.正确` / `B.错误`）

#### 填空题 `[填空]`

```markdown
4. [填空] Python 中用于输出的函数是 ____，换行参数是 ____。
答案：print|end
分值：2
```

- 题干中用 `____` 表示空位
- 多个空的答案用 `|` 分隔

#### 简答题 `[简答]`

```markdown
5. [简答] 请简述列表和元组的区别。
答案：列表可变，元组不可变。
分值：5
解析：可变性是最核心的区别。
```

- 答案为参考答案原文，提交后仅展示不做自动判分

## 完整示例

参见 [tests/fixtures/sample.md](../tests/fixtures/sample.md) 和 [examples/demo-quiz.md](../examples/demo-quiz.md)。
