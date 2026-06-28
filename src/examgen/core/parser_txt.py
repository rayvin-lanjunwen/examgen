"""Parse TXT structured format exam files into data models.

Parses the ``<meta> / <question>`` tag-based format defined in ``docs/spec-txt.txt``.
Produces the same ``ExamMeta`` + ``list[Question]`` output as the Markdown parser.
"""

import html
import re
from typing import List, Optional, Tuple

from examgen.models import ExamMeta, Option, Question, QuestionType
from examgen.core.parser import ParseError  # reuse ParseError for consistent error reporting

# ── 题型标识映射 ──────────────────────────────────────────────────────────
_TYPE_MAP: dict[str, QuestionType] = {
    "single": QuestionType.SINGLE,
    "multiple": QuestionType.MULTIPLE,
    "judge": QuestionType.JUDGE,
    "fill": QuestionType.FILL,
    "essay": QuestionType.ESSAY,
}

# ── 辅助：注释、标签提取、文本处理 ─────────────────────────────────────

_COMMENT_RE = re.compile(r"<!--[\s\S]*?-->")


def _strip_comments(text: str) -> str:
    """移除 ``<!-- ... -->`` 注释。"""
    return _COMMENT_RE.sub("", text)


_TAG_RE_CACHE: dict[str, re.Pattern] = {}


def _get_tag(text: str, tag: str) -> Optional[str]:
    """提取第一个 ``<tag>...</tag>`` 的内容，不存在则返回 None。"""
    if tag not in _TAG_RE_CACHE:
        _TAG_RE_CACHE[tag] = re.compile(f"<{tag}>([\\s\\S]*?)</{tag}>")
    m = _TAG_RE_CACHE[tag].search(text)
    return m.group(1).strip() if m else None


def _get_all_tags(text: str, tag: str) -> List[str]:
    """提取所有 ``<tag>...</tag>`` 的内容列表。"""
    if tag not in _TAG_RE_CACHE:
        _TAG_RE_CACHE[tag] = re.compile(f"<{tag}>([\\s\\S]*?)</{tag}>")
    return [m.group(1).strip() for m in _TAG_RE_CACHE[tag].finditer(text)]


_INLINE_MATH_RE = re.compile(r"<inline-math>([\s\S]*?)</inline-math>")
_DISPLAY_MATH_RE = re.compile(r"<math>([\s\S]*?)</math>")


def _process_text(content: str) -> str:
    """处理文本内容：``<inline-math>`` 转 ``$...$``，``<math>`` 转 ``$$...$$``，HTML 实体反转义。"""
    # 块级公式替换（优先，避免被行内规则误处理）
    content = _DISPLAY_MATH_RE.sub(r"$$\1$$", content)
    # 行内公式替换
    content = _INLINE_MATH_RE.sub(r"$\1$", content)
    # 反转义 &lt; &gt; &amp; 等
    content = html.unescape(content)
    return content


# ── Meta 解析 ─────────────────────────────────────────────────────────────


def _parse_meta(meta_text: str) -> ExamMeta:
    """从 ``<meta>...</meta>`` 内容构建 ExamMeta。"""
    title = _get_tag(meta_text, "title")
    if not title:
        raise ParseError(
            "缺少必填字段", field="title",
            suggestion="请在 <meta> 中填写 <title>试卷标题</title>",
        )

    subject = _get_tag(meta_text, "subject")
    time_val = _get_tag(meta_text, "time")
    total_val = _get_tag(meta_text, "total_score")
    ds_val = _get_tag(meta_text, "default_score")
    ps_val = _get_tag(meta_text, "passing_score")
    shuf_val = _get_tag(meta_text, "shuffle")
    opt_shuf_val = _get_tag(meta_text, "option_shuffle")

    # 类型校验
    def _as_int(raw: Optional[str], tag: str) -> Optional[int]:
        if not raw:
            return None
        try:
            return int(raw)
        except (ValueError, TypeError):
            raise ParseError(
                f"<{tag}> 值无效：'{raw}'", field=tag,
                suggestion=f"{tag} 必须是纯整数",
            ) from None

    def _as_float(raw: Optional[str], tag: str, default: Optional[float] = None) -> Optional[float]:
        if not raw:
            return default
        try:
            return float(raw)
        except (ValueError, TypeError):
            raise ParseError(
                f"<{tag}> 值无效：'{raw}'", field=tag,
                suggestion=f"{tag} 必须是数字",
            ) from None

    return ExamMeta(
        title=title,
        subject=subject,
        time=_as_int(time_val, "time"),
        total_score=_as_float(total_val, "total_score"),
        default_score=_as_float(ds_val, "default_score", 1.0) or 1.0,
        passing_score=_as_float(ps_val, "passing_score"),
        shuffle=(shuf_val or "").strip().lower() == "true",
        option_shuffle=(opt_shuf_val or "").strip().lower() == "true",
    )


# ── Options 解析 ──────────────────────────────────────────────────────────

_OPTION_TAG_RE = re.compile(r"<option>([\s\S]*?)</option>")


def _parse_options(options_text: str) -> List[Option]:
    """从 ``<options>`` 内容中提取 ``<option>`` 列表。

    每个 ``<option>`` 必须包含 ``<label>`` 和 ``<text>`` 子标签。
    """
    result: List[Option] = []
    for m in _OPTION_TAG_RE.finditer(options_text):
        opt_body = m.group(1)
        label_val = _get_tag(opt_body, "label")
        text_val = _get_tag(opt_body, "text")

        if not label_val or not text_val:
            # 容错旧格式：A. xxx
            raw = opt_body.strip()
            processed = _INLINE_MATH_RE.sub(r"$\1$", raw)
            processed = html.unescape(processed)
            label_m = re.match(r"^([A-Z])\.\s*(.*)", processed, re.DOTALL)
            if label_m:
                result.append(Option(label=label_m.group(1), text=label_m.group(2).strip()))
            else:
                label = processed[0] if processed else "?"
                result.append(Option(label=label, text=processed))
            continue

        # 处理行内公式和实体
        text_processed = _INLINE_MATH_RE.sub(r"$\1$", text_val.strip())
        text_processed = html.unescape(text_processed)
        result.append(Option(label=label_val.strip(), text=text_processed))
    return result


# ── Question 解析 ─────────────────────────────────────────────────────────

# 资源标签名集合，用于按出现顺序追加到 topic
_RESOURCE_TAGS = ("image", "table", "math")
_RESOURCE_RE = re.compile(
    r"<(image|table|math)>([\s\S]*?)</\1>"
)


def _parse_question(q_text: str, index: int) -> Question:
    """从单个 ``<question>...</question>`` 内容构建 Question。"""
    field_tag = f"第 {index + 1} 题"

    # ── 必填字段 ──
    id_val = _get_tag(q_text, "id")
    if not id_val:
        raise ParseError(
            f"{field_tag} 缺少 <id>", field=field_tag,
            suggestion="每道题需要 <id>题号</id>",
        )
    try:
        qid = int(id_val)
    except (ValueError, TypeError):
        raise ParseError(
            f"{field_tag} 的 <id> 值无效：'{id_val}'", field=field_tag,
            suggestion="id 必须是整数",
        ) from None

    type_val = _get_tag(q_text, "type")
    if not type_val:
        raise ParseError(
            f"{field_tag} 缺少 <type>", field=field_tag,
            suggestion="题型取值为 single / multiple / judge / fill / essay",
        )
    type_lower = type_val.strip().lower()
    if type_lower not in _TYPE_MAP:
        raise ParseError(
            f"{field_tag} 的题型 '{type_val}' 无效", field=field_tag,
            suggestion=f"合法题型：{list(_TYPE_MAP.keys())}",
        )
    qtype = _TYPE_MAP[type_lower]

    topic_val = _get_tag(q_text, "topic")
    if not topic_val:
        raise ParseError(
            f"{field_tag} 缺少 <topic>", field=field_tag,
            suggestion="每道题需要 <topic>题干内容</topic>",
        )
    topic = _process_text(topic_val)

    answer_val = _get_tag(q_text, "answer")
    if not answer_val:
        raise ParseError(
            f"{field_tag} 缺少 <answer>", field=field_tag,
            suggestion="每道题需要 <answer>答案</answer>",
        )
    answer = answer_val.strip()

    # ── 可选字段 ──
    section = _get_tag(q_text, "section")

    score_val = _get_tag(q_text, "score")
    try:
        score = float(score_val) if score_val else None
    except (ValueError, TypeError):
        raise ParseError(
            f"{field_tag} 的 <score> 值无效：'{score_val}'", field=field_tag,
            suggestion="score 必须是数字",
        ) from None

    # 解析：合并 keywords 到 explanation
    explanation_val = _get_tag(q_text, "explanation")
    keywords_val = _get_tag(q_text, "keywords")
    if keywords_val:
        kw_line = f"\n关键词：{keywords_val.strip()}"
        raw_exp = (explanation_val or "") + kw_line
        explanation = _process_text(raw_exp) if raw_exp.strip() else None
    elif explanation_val:
        explanation = _process_text(explanation_val)
    else:
        explanation = None

    # 选项
    options_text = _get_tag(q_text, "options")
    options = _parse_options(options_text) if options_text else []

    # ── 资源标签：按出现顺序追加到 topic ──
    resources: List[Tuple[int, str, str]] = []
    for rm in _RESOURCE_RE.finditer(q_text):
        tag_name = rm.group(1)
        content = rm.group(2).strip()
        resources.append((rm.start(), tag_name, content))

    # 按位置排序，保持写入顺序
    resources.sort(key=lambda x: x[0])
    for _, tag_name, content in resources:
        if tag_name == "image":
            # 图片 → Markdown 图片语法
            alt = content.rsplit(".", 1)[0] if "." in content else content
            topic += f"\n\n![{alt}]({content})"
        elif tag_name == "table":
            # 表格内容中可能有 <inline-math>
            tbl = _INLINE_MATH_RE.sub(r"$\1$", content)
            tbl = html.unescape(tbl)
            topic += f"\n\n{tbl}"
        elif tag_name == "math":
            # 块级公式 → $$...$$
            topic += f"\n\n$${content}$$"

    return Question(
        id=qid,
        qtype=qtype,
        topic=topic,
        options=options,
        answer=answer,
        score=score,
        section=section,
        explanation=explanation,
    )


# ── 公开入口 ──────────────────────────────────────────────────────────────


def parse_exam_text_txt(text: str) -> Tuple[ExamMeta, List[Question]]:
    """解析 TXT 结构化格式文本，返回 ExamMeta 和 Question 列表。

    Parameters
    ----------
    text : str
        符合 ``docs/spec-txt.txt`` 规范的完整文件内容。

    Returns
    -------
    Tuple[ExamMeta, List[Question]]
        与 ``parse_exam_text`` 返回类型一致，可直接对接后续流程。
    """
    # 移除注释
    text = _strip_comments(text).strip()

    if not text:
        raise ParseError(
            "文件内容为空",
            suggestion="请按照 spec-txt.txt 规范编写试卷内容",
        )

    # 解析 <meta>
    meta_text = _get_tag(text, "meta")
    if not meta_text:
        raise ParseError(
            "缺少 <meta>...</meta> 块",
            suggestion="文件必须以 <meta> 开始，包含试卷元数据",
        )
    meta = _parse_meta(meta_text)

    # 定位 </meta> 后面的题目区
    meta_close = "</meta>"
    meta_end = text.find(meta_close)
    if meta_end == -1:
        raise ParseError("<meta> 缺少闭合标签 </meta>")
    remainder = text[meta_end + len(meta_close):]

    # 解析 <question> 块
    q_blocks = _get_all_tags(remainder, "question")
    if not q_blocks:
        raise ParseError(
            "未找到任何 <question> 块",
            suggestion="至少需要一道题目",
        )

    questions: List[Question] = []
    seen_ids: set[int] = set()
    for i, q_text in enumerate(q_blocks):
        q = _parse_question(q_text, i)
        if q.id in seen_ids:
            raise ParseError(
                f"题号 <id>{q.id}</id> 重复",
                field=f"第 {q.id} 题",
                suggestion="每道题的 id 必须唯一",
            )
        seen_ids.add(q.id)
        questions.append(q)

    return meta, questions


__all__ = ["parse_exam_text_txt"]
