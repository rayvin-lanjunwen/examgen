"""Parse Markdown exam files into structured data models.

Supports two formats:
1. New format with ``#题干`` / ``#答案`` / ``#分值`` / ``#解析`` / ``#图片`` / ``#表格`` / ``#选项`` block markers.
2. Legacy format with inline ``答案：`` / ``分值：`` / ``解析：`` markers.
"""

import re
from pathlib import Path
from typing import List, Optional, Tuple

import frontmatter

from examgen.models import ExamMeta, Option, Question, QuestionType


# ── ParseError：结构化错误信息 ────────────────────────────────────────────

class ParseError(Exception):
    """解析错误，携带结构化信息便于前端展示。

    Attributes
    ----------
    message : str
        人类可读的错误描述。
    field : str or None
        出错的字段名或区块（如 ``"time"``、``"第 3 题"``）。
    suggestion : str or None
        修复建议。
    """

    def __init__(self, message: str, field: Optional[str] = None, suggestion: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.field = field
        self.suggestion = suggestion


# ── 题型中文标识 → QuestionType 映射 ──────────────────────────────────────
_QTYPE_MAP: dict[str, QuestionType] = {
    "单选": QuestionType.SINGLE,
    "多选": QuestionType.MULTIPLE,
    "判断": QuestionType.JUDGE,
    "填空": QuestionType.FILL,
    "简答": QuestionType.ESSAY,
}

# 题目首行正则：支持 #1. [题型] 和 1. [题型] 题干
_RE_FIRST_LINE = re.compile(
    r"^#?(\d+)\.\s*\[([^\]]+)\]\s*(.*)$",
    re.MULTILINE,
)
# 选项行：- A. text  /  - B. text
_RE_OPTION = re.compile(r"^-\s+([A-Z])\.\s*(.+)$", re.MULTILINE)

# 题目起始标记（支持新旧格式）
_RE_Q_START = re.compile(r"^#?\d+\.\s*\[", re.MULTILINE)

# 分区标题：## 标题内容
_RE_SECTION = re.compile(r"^##\s+(.+)$", re.MULTILINE)

# 字段标记行 — 新旧格式通用
#   新格式：#答案  /  #分值  /  #解析  /  #题干  /  #图片  /  #表格  /  #选项
#   旧格式：答案： /  分值： /  解析：
#   容错：也接受 \#答案 等带反斜杠转义的写法（AI 生成常见错误）
_RE_FIELD_MARKER_NEW = re.compile(r"^#(答案|解析|分值|题干|图片|表格|选项)\s*$")
_RE_FIELD_MARKER_LEGACY = re.compile(r"^(答案|解析|分值)[：:]\s*(.*)$")

# 缓存 _extract_multiline_field 编译的正则，避免重复编译
_FIELD_START_CACHE: dict[str, re.Pattern] = {}

# ── ExamMeta 构建 ─────────────────────────────────────────────────────────


# ── 常见的 YAML 字段名错误映射 ──────────────────────────────────────────
_YAML_ALIASES: dict[str, str] = {
    "course": "subject",
    "score": "total_score",
}


def _validate_yaml_meta(meta: dict) -> None:
    """预检 YAML 元数据的常见错误，给出具体修复建议。"""
    # 检查常见字段名错误
    for wrong, correct in _YAML_ALIASES.items():
        if wrong in meta:
            raise ParseError(
                f"YAML 字段名错误：`{wrong}` 不是有效字段",
                field=wrong,
                suggestion=f"请将 `{wrong}` 改为 `{correct}`",
            )

    # 检查 time 字段类型
    if "time" in meta:
        try:
            int(meta["time"])
        except (ValueError, TypeError):
            raise ParseError(
                f"YAML 字段 `time` 的值 `{meta['time']}` 无效",
                field="time",
                suggestion="`time` 必须是纯整数（分钟），如 `90`，不能带单位（不要写成 `90分钟` 或 `90min`）",
            )

    # 检查 total_score 字段类型
    if "total_score" in meta:
        try:
            float(meta["total_score"])
        except (ValueError, TypeError):
            raise ParseError(
                f"YAML 字段 `total_score` 的值 `{meta['total_score']}` 无效",
                field="total_score",
                suggestion="`total_score` 必须是数字，如 `100`",
            )


def _build_exam_meta(meta: dict) -> ExamMeta:
    """Build an ExamMeta instance from a raw metadata dict."""
    _validate_yaml_meta(meta)

    if "title" not in meta or not meta["title"]:
        raise ParseError(
            "Front matter 缺少必填字段",
            field="title",
            suggestion="请在 YAML 中填写 `title: 试卷标题`",
        )

    try:
        return ExamMeta(
            title=str(meta["title"]),
            subject=str(meta["subject"]) if meta.get("subject") else None,
            time=int(meta["time"]) if meta.get("time") is not None else None,
            total_score=float(meta["total_score"]) if meta.get("total_score") is not None else None,
            default_score=float(meta.get("default_score", 1.0)),
            shuffle=bool(meta.get("shuffle", False)),
            option_shuffle=bool(meta.get("option_shuffle", False)),
            passing_score=float(meta["passing_score"]) if meta.get("passing_score") is not None else None,
        )
    except (ValueError, TypeError) as e:
        raise ParseError(
            f"YAML 元数据解析失败：{e}",
            suggestion="请检查 front matter 中各字段的值类型是否正确",
        ) from e


# ── 题目正文拆分（按 ^#?\d+.\s*[ 切分 + 提取 ## 分区）─────────────────


def _split_questions(raw_text: str) -> List[Tuple[str, Optional[str]]]:
    """按题目起始标记切分，同时提取 ``## 分区标题`` 作为上下文。

    返回 ``[(题目区块文本, 所属分区标题或 None), ...]``。
    """
    # 容错：移除 AI 生成常见反斜杠转义（\#、\-、\\.、\\[ 等）
    text = _strip_leading_backslash(raw_text.strip())

    # 收集所有题目起始位置
    q_positions: List[int] = [m.start() for m in _RE_Q_START.finditer(text)]

    if not q_positions:
        return []

    # 收集所有分区标题及其结束位置
    s_pairs: List[Tuple[str, int]] = []
    for m in _RE_SECTION.finditer(text):
        s_pairs.append((m.group(1).strip(), m.end()))

    blocks: List[Tuple[str, Optional[str]]] = []
    for i, pos in enumerate(q_positions):
        # 当前题目块的结束位置 = 下一题起始（或文末）
        end = q_positions[i + 1] if i + 1 < len(q_positions) else len(text)
        block = text[pos:end].strip()

        # 找到该题之前最后一个分区标题
        section: Optional[str] = None
        for sec_title, sec_end in s_pairs:
            if sec_end <= pos:
                section = sec_title

        blocks.append((block, section))

    return blocks


# ── 内容区块划分 ──────────────────────────────────────────────────────────


def _strip_leading_backslash(line: str) -> str:
    """移除 AI 生成常见的反斜杠转义（``\\#``、``\\-``、``\\[``、``\\]``、``\\.``）。

    ``\\#`` / ``\\-`` / ``\\.`` 全局替换（不影响 LaTeX 公式）。
    ``\\[`` / ``\\]`` 在行首/行尾出现且内容不含 LaTeX 命令时才去转义。
    """
    line = line.replace("\\#", "#").replace("\\-", "-").replace("\\.", ".")

    # \[...\] 包围的内容：不含 \字母 才是 AI 转义，含则为 LaTeX 公式
    stripped = line.lstrip()
    if stripped.startswith("\\[") and stripped.endswith("\\]"):
        inner = stripped[2:-2]
        if not re.search(r"\\[a-zA-Z]", inner):
            indent = line[: len(line) - len(stripped)]
            line = indent + "[" + inner + "]"
    elif stripped.startswith("\\["):
        after = stripped[2:]
        if not re.search(r"\\[a-zA-Z]", after):
            indent = line[: len(line) - len(stripped)]
            line = indent + "[" + after
    elif stripped.endswith("\\]"):
        before = stripped[:-2]
        if not re.search(r"\\[a-zA-Z]", before):
            indent = line[: len(line) - len(stripped)]
            line = indent + before + "]"

    return line


def _parse_content_blocks(block: str) -> dict[str, str]:
    """将题目区块按 ``#标记`` 行切分，返回 ``{标记名: 内容}`` 字典。

    旧格式（无 #标记）时，"题干" 从首行提取，其余从字段行提取。
    """
    lines = block.split("\n")
    result: dict[str, str] = {}

    # 检测是否使用新格式（容错：先剥离反斜杠再检测）
    has_new_markers = any(
        _RE_FIELD_MARKER_NEW.match(_strip_leading_backslash(ln)) for ln in lines
    )

    if not has_new_markers:
        # 旧格式：不回退到 block-level 处理，返回空让 _parse_question_block 走 legacy 路径
        return result

    # 新格式：按 #标记 切分区块
    current_field: Optional[str] = None
    current_lines: List[str] = []
    in_comment = False  # 跳过 HTML 注释块 <!-- ... -->

    for line in lines:
        normalized = _strip_leading_backslash(line)

        # 跳过 HTML 注释块
        if in_comment:
            if "-->" in line:
                in_comment = False
            continue
        if line.strip().startswith("<!--"):
            if "-->" not in line:
                in_comment = True
            continue

        # 遇到分区标题或下一题起始符则提前终止（跳过当前题目首行）
        if (_RE_SECTION.match(normalized) or _RE_Q_START.match(normalized)) and current_field is not None:
            result[current_field] = "\n".join(current_lines).strip()
            break

        m = _RE_FIELD_MARKER_NEW.match(normalized)
        if m:
            # 保存上一个区块
            if current_field is not None:
                result[current_field] = "\n".join(current_lines).strip()
            current_field = m.group(1)
            current_lines = []
        else:
            if current_field is not None:
                current_lines.append(line)

    # 保存最后一个区块
    if current_field is not None:
        result[current_field] = "\n".join(current_lines).strip()

    return result


# ── 多行字段提取（旧格式兼容）────────────────────────────────────────────


def _extract_multiline_field(block: str, field: str) -> str:
    """从题目区块中提取可能跨多行的字段内容。

    支持两种格式：
    1. 单行：  ``答案：D``  →  ``"D"``
    2. 多行：  ``答案：`` 换行后接内容，直到下一个字段标记或区块结束。
    """
    lines = block.split("\n")
    if field not in _FIELD_START_CACHE:
        _FIELD_START_CACHE[field] = re.compile(
            r"^" + re.escape(field) + r"[：:]\s*(.*)$"
        )
    field_start = _FIELD_START_CACHE[field]

    for i, line in enumerate(lines):
        m = field_start.match(line)
        if not m:
            continue
        # 同行内容
        same_line = m.group(1).strip()
        if same_line:
            return same_line
        # 多行模式：收集后续行直到下一个字段标记或题目起始
        content_lines: List[str] = []
        for j in range(i + 1, len(lines)):
            stripped_j = _strip_leading_backslash(lines[j])
            if _RE_FIELD_MARKER_LEGACY.match(lines[j]):
                break
            if _RE_FIELD_MARKER_NEW.match(stripped_j):
                break
            if _RE_Q_START.match(stripped_j) or _RE_SECTION.match(stripped_j):
                break
            content_lines.append(lines[j])
        return "\n".join(content_lines).strip()

    return ""


# ── 单题解析 ──────────────────────────────────────────────────────────────


def _parse_question_block(
    block: str, index: int, section: Optional[str] = None
) -> Question:
    """从单个题目区块中解析 Question 对象，兼容新旧两种格式。"""
    qid = index + 1
    field_tag = f"第 {qid} 题"

    # 先尝试新格式按 #标记 切分
    blocks = _parse_content_blocks(block)

    # 1) 提取题型（容错：剥离首行反斜杠）
    first_line = _strip_leading_backslash(block.split("\n")[0].strip())
    m_first = _RE_FIRST_LINE.search(first_line)
    if not m_first:
        raise ParseError(
            f"{field_tag} 的首行格式无效",
            field=field_tag,
            suggestion="题目首行应为 `#题号. [题型]`，如 `#1. [单选]`。请检查是否有反斜杠转义或缺少题型标记",
        )

    type_str = m_first.group(2).strip()

    if type_str not in _QTYPE_MAP:
        raise ParseError(
            f"{field_tag} 的题型标识 `[{type_str}]` 无效",
            field=field_tag,
            suggestion=f"合法题型: {list(_QTYPE_MAP.keys())}",
        )
    qtype = _QTYPE_MAP[type_str]

    # 2) 题干 — 新格式从 #题干 块取，旧格式从首行取
    if "题干" in blocks:
        topic = blocks["题干"]
    else:
        topic = m_first.group(3).strip()

    # 附件内容追加到题干
    extra_parts: List[str] = []
    if "图片" in blocks:
        extra_parts.append(blocks["图片"])
    if "表格" in blocks:
        extra_parts.append(blocks["表格"])
    if extra_parts:
        topic = topic + "\n\n" + "\n\n".join(extra_parts) if topic else "\n\n".join(extra_parts)

    # 3) 提取选项（容错：剥离选项行反斜杠）
    options: List[Option] = []
    option_source = blocks.get("选项", "") if "选项" in blocks else block
    # 逐行剥离反斜杠后匹配
    for line in option_source.split("\n"):
        stripped = _strip_leading_backslash(line)
        m_opt = _RE_OPTION.match(stripped)
        if m_opt:
            options.append(Option(label=m_opt.group(1), text=m_opt.group(2).strip()))

    # 4) 答案 — 新格式优先
    answer = blocks.get("答案", "") or _extract_multiline_field(block, "答案")

    # 5) 分值 — 新格式优先
    score_val = blocks.get("分值", "") or _extract_multiline_field(block, "分值")
    try:
        score: Optional[float] = float(score_val) if score_val else None
    except (ValueError, TypeError):
        raise ParseError(
            f"{field_tag} 的 `分值` 格式无效：`{score_val}`",
            field=field_tag,
            suggestion="分值应为纯数字，如 `2` 或 `2.5`",
        )

    # 6) 解析 — 新格式优先
    explanation = blocks.get("解析", "") or _extract_multiline_field(block, "解析")

    return Question(
        id=qid,
        qtype=qtype,
        topic=topic,
        options=options,
        answer=answer,
        score=score,  # None 留给 normalizer 用 meta.default_score 填充
        section=section,
        explanation=explanation if explanation else None,
    )


# ── 题目列表组装 ──────────────────────────────────────────────────────────


def _parse_questions(content: str) -> List[Question]:
    """Parse Markdown content into a list of Question instances."""
    blocks_with_sections = _split_questions(content)
    questions: List[Question] = []
    for idx, (block, section) in enumerate(blocks_with_sections):
        questions.append(_parse_question_block(block, idx, section))
    return questions


# ── 公开入口 ──────────────────────────────────────────────────────────────


def parse_exam_file(file_path: str) -> Tuple[ExamMeta, List[Question]]:
    """Parse an exam Markdown file and return metadata and questions."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")

    try:
        post = frontmatter.load(str(path))
    except Exception as e:
        raise ParseError(
            f"YAML front matter 解析失败：{e}",
            suggestion="请确保文件以 `---` 开头和结尾，中间为有效的 YAML 键值对",
        ) from e

    try:
        meta = _build_exam_meta(post.metadata)
    except ParseError:
        raise
    except Exception as e:
        raise ParseError(
            f"YAML 元数据处理失败：{e}",
            suggestion="请检查 front matter 中各字段的值类型是否正确",
        ) from e

    try:
        questions = _parse_questions(post.content)
    except ParseError:
        raise
    except Exception as e:
        raise ParseError(
            f"题目正文解析失败：{e}",
            suggestion="请检查题目格式是否符合规范",
        ) from e

    return meta, questions


def parse_exam_text(md_text: str) -> Tuple[ExamMeta, List[Question]]:
    """从 Markdown 字符串直接解析，无需文件路径。"""
    try:
        post = frontmatter.loads(md_text)
    except Exception as e:
        raise ParseError(
            f"YAML front matter 解析失败：{e}",
            suggestion="请确保文件以 `---` 开头和结尾，中间为有效的 YAML 键值对",
        ) from e

    try:
        meta = _build_exam_meta(post.metadata)
    except ParseError:
        raise
    except Exception as e:
        raise ParseError(
            f"YAML 元数据处理失败：{e}",
            suggestion="请检查 front matter 中各字段的值类型是否正确",
        ) from e

    try:
        questions = _parse_questions(post.content)
    except ParseError:
        raise
    except Exception as e:
        raise ParseError(
            f"题目正文解析失败：{e}",
            suggestion="请检查题目格式是否符合规范",
        ) from e

    return meta, questions

# ── Expose ParseError in module namespace ─────────────────────────────────

__all__ = ["parse_exam_file", "parse_exam_text", "ParseError"]
