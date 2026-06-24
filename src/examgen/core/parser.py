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

# ── 题型中文标识 → QuestionType 映射 ──────────────────────────────────────
_QTYPE_MAP: dict[str, QuestionType] = {
    "单选": QuestionType.SINGLE,
    "多选": QuestionType.MULTIPLE,
    "判断": QuestionType.JUDGE,
    "填空": QuestionType.FILL,
    "简答": QuestionType.ESSAY,
}

# 题目首行正则：支持新格式 #1. [题型] 和旧格式 1. [题型] 题干
_RE_FIRST_LINE = re.compile(
    r"^#?(\d+)\.\s*\[([^\]]+)\]\s*(.*)$",
    re.MULTILINE,
)
# 选项行：- A. text  /  - B. text
_RE_OPTION = re.compile(r"^-\s+([A-Z])\.\s*(.+)$", re.MULTILINE)

# 题目起始标记（支持新旧格式）：^#?\d+.\s*[
_RE_Q_START = re.compile(r"^#?\d+\.\s*\[", re.MULTILINE)

# 分区标题：## 标题内容
_RE_SECTION = re.compile(r"^##\s+(.+)$", re.MULTILINE)

# 字段标记行 — 新旧格式通用
#   新格式：#答案  /  #分值  /  #解析  /  #题干  /  #图片  /  #表格  /  #选项
#   旧格式：答案： /  分值： /  解析：
_RE_FIELD_MARKER_NEW = re.compile(r"^#(答案|解析|分值|题干|图片|表格|选项)\s*$")
_RE_FIELD_MARKER_LEGACY = re.compile(r"^(答案|解析|分值)[：:]\s*(.*)$")

# 缓存 _extract_multiline_field 编译的正则，避免重复编译
_FIELD_START_CACHE: dict[str, re.Pattern] = {}

# ── ExamMeta 构建 ─────────────────────────────────────────────────────────


def _build_exam_meta(meta: dict) -> ExamMeta:
    """Build an ExamMeta instance from a raw metadata dict."""
    if "title" not in meta or not meta["title"]:
        raise ValueError("Front matter 必须包含 'title' 字段")

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


# ── 题目正文拆分（按 ^#?\d+.\s*[ 切分 + 提取 ## 分区）─────────────────


def _split_questions(raw_text: str) -> List[Tuple[str, Optional[str]]]:
    """按题目起始标记切分，同时提取 ``## 分区标题`` 作为上下文。

    返回 ``[(题目区块文本, 所属分区标题或 None), ...]``。
    """
    text = raw_text.strip()

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


def _parse_content_blocks(block: str) -> dict[str, str]:
    """将题目区块按 ``#标记`` 行切分，返回 ``{标记名: 内容}`` 字典。

    旧格式（无 #标记）时，"题干" 从首行提取，其余从字段行提取。
    """
    lines = block.split("\n")
    result: dict[str, str] = {}

    # 检测是否使用新格式
    has_new_markers = any(_RE_FIELD_MARKER_NEW.match(ln) for ln in lines)

    if not has_new_markers:
        # 旧格式：不回退到 block-level 处理，返回空让 _parse_question_block 走 legacy 路径
        return result

    # 新格式：按 #标记 切分区块
    current_field: Optional[str] = None
    current_lines: List[str] = []
    in_comment = False  # 跳过 HTML 注释块 <!-- ... -->

    for line in lines:
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
        if (_RE_SECTION.match(line) or _RE_Q_START.match(line)) and current_field is not None:
            result[current_field] = "\n".join(current_lines).strip()
            break

        m = _RE_FIELD_MARKER_NEW.match(line)
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
        # 多行模式：收集后续行直到下一个字段标记
        content_lines: List[str] = []
        for j in range(i + 1, len(lines)):
            if _RE_FIELD_MARKER_LEGACY.match(lines[j]):
                break
            content_lines.append(lines[j])
        return "\n".join(content_lines).strip()

    return ""


# ── 单题解析 ──────────────────────────────────────────────────────────────


def _parse_question_block(
    block: str, index: int, section: Optional[str] = None
) -> Question:
    """从单个题目区块中解析 Question 对象，兼容新旧两种格式。"""
    # 先尝试新格式按 #标记 切分
    blocks = _parse_content_blocks(block)

    # 1) 提取题型
    first_line = block.split("\n")[0].strip()
    m_first = _RE_FIRST_LINE.search(first_line)
    if not m_first:
        raise ValueError(f"无法解析题目首行，区块内容:\n{block[:200]}")

    type_str = m_first.group(2).strip()

    if type_str not in _QTYPE_MAP:
        raise ValueError(
            f"未知题型标识: [{type_str}]，合法值: {list(_QTYPE_MAP.keys())}"
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

    # 3) 提取选项
    options: List[Option] = []
    if "选项" in blocks:
        for m_opt in _RE_OPTION.finditer(blocks["选项"]):
            options.append(Option(label=m_opt.group(1), text=m_opt.group(2).strip()))
    else:
        # 旧格式：从整个 block 中提取
        for m_opt in _RE_OPTION.finditer(block):
            options.append(Option(label=m_opt.group(1), text=m_opt.group(2).strip()))

    # 4) 答案 — 新格式优先
    answer = blocks.get("答案", "") or _extract_multiline_field(block, "答案")

    # 5) 分值 — 新格式优先
    score_val = blocks.get("分值", "") or _extract_multiline_field(block, "分值")
    score: Optional[float] = float(score_val) if score_val else None

    # 6) 解析 — 新格式优先
    explanation = blocks.get("解析", "") or _extract_multiline_field(block, "解析")

    return Question(
        id=index + 1,
        qtype=qtype,
        topic=topic,
        options=options,
        answer=answer,
        score=score if score is not None else 1.0,
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

    post = frontmatter.load(str(path))
    meta = _build_exam_meta(post.metadata)
    questions = _parse_questions(post.content)

    return meta, questions


def parse_exam_text(md_text: str) -> Tuple[ExamMeta, List[Question]]:
    """从 Markdown 字符串直接解析，无需文件路径。"""
    post = frontmatter.loads(md_text)
    meta = _build_exam_meta(post.metadata)
    questions = _parse_questions(post.content)
    return meta, questions
