"""Parse Markdown exam files into structured data models."""

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

# 第一行正则：题号. [题型] 题干
_RE_FIRST_LINE = re.compile(
    r"^\d+\.\s*\[([^\]]+)\]\s*(.+)$",
    re.MULTILINE,
)
# 选项行：- A. text  /  - B. text
_RE_OPTION = re.compile(r"^-\s+([A-Z])\.\s*(.+)$", re.MULTILINE)


# ── ExamMeta 构建 ─────────────────────────────────────────────────────────
def _build_exam_meta(meta: dict) -> ExamMeta:
    """Build an ExamMeta instance from a raw metadata dict.

    Handles type coercion and missing-field defaults.
    """
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


# ── 题目正文拆分 ──────────────────────────────────────────────────────────
def _split_questions(raw_text: str) -> List[str]:
    """按空行将题目正文拆分为独立区块。

    连续空行（两个及以上换行）视为题目分隔符；单个换行保留在区块内部。
    """
    # 用两个及以上连续换行拆分
    blocks = re.split(r"\n{2,}", raw_text.strip())
    # 过滤空白块
    return [b.strip() for b in blocks if b.strip()]


# ── 单题解析 ──────────────────────────────────────────────────────────────
def _parse_question_block(block: str, index: int) -> Question:
    """从单个题目区块字符串中解析出 Question 对象。

    Parameters
    ----------
    block : str
        一道题的完整文本块。
    index : int
        该题在列表中的位置索引（从 0 开始），用作 ``Question.id``。

    Returns
    -------
    Question
        解析后的题目数据对象。
    """
    lines = block.strip()

    # 1) 提取题型 & 题干
    m_first = _RE_FIRST_LINE.search(lines)
    if not m_first:
        raise ValueError(f"无法解析题目首行，区块内容:\n{block}")

    type_str = m_first.group(1).strip()
    topic = m_first.group(2).strip()

    if type_str not in _QTYPE_MAP:
        raise ValueError(f"未知题型标识: [{type_str}]，合法值: {list(_QTYPE_MAP.keys())}")
    qtype = _QTYPE_MAP[type_str]

    # 2) 提取选项
    options: List[Option] = []
    for m_opt in _RE_OPTION.finditer(lines):
        options.append(Option(label=m_opt.group(1), text=m_opt.group(2).strip()))

    # 3) 提取 "答案：" 行
    answer = _extract_field(lines, "答案")

    # 4) 提取 "分值：" 行
    score_val = _extract_field(lines, "分值")
    score: Optional[float] = float(score_val) if score_val else None

    # 5) 提取 "解析：" 行
    explanation = _extract_field(lines, "解析")

    return Question(
        id=index + 1,
        qtype=qtype,
        topic=topic,
        options=options,
        answer=answer,
        score=score if score is not None else 1.0,
        explanation=explanation if explanation else None,
    )


def _extract_field(text: str, field_name: str) -> str:
    """从题目区块中提取以 ``field_name：`` 或 ``field_name:`` 开头的行内容。"""
    pattern = re.compile(
        rf"^{re.escape(field_name)}[：:]\s*(.+)$",
        re.MULTILINE,
    )
    m = pattern.search(text)
    return m.group(1).strip() if m else ""


# ── 题目列表组装 ──────────────────────────────────────────────────────────
def _parse_questions(content: str) -> List[Question]:
    """Parse Markdown content into a list of Question instances."""
    blocks = _split_questions(content)
    questions: List[Question] = []
    for idx, block in enumerate(blocks):
        questions.append(_parse_question_block(block, idx))
    return questions


# ── 公开入口 ──────────────────────────────────────────────────────────────
def parse_exam_file(file_path: str) -> Tuple[ExamMeta, List[Question]]:
    """Parse an exam Markdown file and return metadata and questions.

    Parameters
    ----------
    file_path : str
        Path to the ``.md`` exam source file.

    Returns
    -------
    Tuple[ExamMeta, List[Question]]
        Parsed exam metadata and question list.

    Raises
    ------
    ValueError
        If the front matter is missing the required ``title`` field.
    FileNotFoundError
        If *file_path* does not exist.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")

    post = frontmatter.load(str(path))
    meta = _build_exam_meta(post.metadata)
    questions = _parse_questions(post.content)

    return meta, questions


def parse_exam_text(md_text: str) -> Tuple[ExamMeta, List[Question]]:
    """从 Markdown 字符串直接解析，无需文件路径。

    适用于 Web 场景下内存中传入的文本。

    Parameters
    ----------
    md_text : str
        完整的 Markdown 文本（含 front matter）。

    Returns
    -------
    Tuple[ExamMeta, List[Question]]
        解析后的试卷元数据和题目列表。

    Raises
    ------
    ValueError
        如果 front matter 缺少 ``title`` 字段。
    """
    post = frontmatter.loads(md_text)
    meta = _build_exam_meta(post.metadata)
    questions = _parse_questions(post.content)
    return meta, questions
