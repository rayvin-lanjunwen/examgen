"""对题目列表应用随机化等变换。"""

import random
from typing import List

from examgen.models import ExamMeta, Option, Question, QuestionType

# 支持选项打乱的题型
_OPTION_SHUFFLEABLE = frozenset({
    QuestionType.SINGLE,
    QuestionType.MULTIPLE,
    QuestionType.JUDGE,
})


def apply_transforms(questions: List[Question], meta: ExamMeta) -> List[Question]:
    """根据 ExamMeta 配置对题目列表做变换。

    处理内容：
    1. meta.shuffle 为 True 时，在每个 ``## 分区`` 内随机打乱题目顺序，
       保持分区之间的顺序不变。
    2. meta.option_shuffle 为 True 时，对单选/多选/判断题随机打乱选项顺序，
       并同步更新 answer 中的字母映射。

    不修改原列表；返回新的列表（浅拷贝，需要变换的题目会创建新对象）。

    Note: 测试时可在调用前设置 random.seed() 以保证结果可复现。
    """
    result = list(questions)  # 浅拷贝列表

    # 1) 题目顺序打乱（按分区分别打乱，维持分区顺序）
    if meta.shuffle:
        result = _shuffle_within_sections(result)

    # 2) 选项顺序打乱
    if meta.option_shuffle:
        result = [
            _shuffle_options(q) if q.qtype in _OPTION_SHUFFLEABLE and q.options else q
            for q in result
        ]

    return result


def _shuffle_within_sections(questions: List[Question]) -> List[Question]:
    """在每个分区内随机打乱题目顺序，保持分区之间的顺序不变。"""
    sections: List[tuple] = []  # [(questions_in_section, ...)]
    current: List[Question] = []
    last_section = None

    for q in questions:
        sec = q.section if q.section else "__none__"
        if sec != last_section and len(current) > 0:
            sections.append(current)
            current = []
        current.append(q)
        last_section = sec
    if len(current) > 0:
        sections.append(current)

    result: List[Question] = []
    for group in sections:
        random.shuffle(group)
        result.extend(group)

    return result


def _shuffle_options(q: Question) -> Question:
    """打乱单道题的选项顺序，并重新映射答案字母。

    流程：
    1. 记录 old_label → content 映射。
    2. 打乱 content 列表。
    3. 按新位置重新分配 A, B, C … 标签。
    4. 通过 content 做桥接，构建 old_label → new_label 映射。
    5. 用该映射重写 answer。
    """
    # 旧映射: label → text
    old_label_to_text = {opt.label: opt.text for opt in q.options}

    # 打乱 (label, text) 对，基于位置分配新标签
    pairs = [(opt.label, opt.text) for opt in q.options]
    random.shuffle(pairs)

    # 构建 old_label → new_label 映射（通过位置桥接，容忍重复文本）
    old_to_new: dict[str, str] = {}
    new_options: list[Option] = []
    for i, (old_label, text) in enumerate(pairs):
        new_label = chr(ord("A") + i)
        old_to_new[old_label] = new_label
        new_options.append(Option(label=new_label, text=text))

    # 重写答案
    new_answer = "".join(old_to_new.get(ch, ch) for ch in q.answer)

    # 返回新 Question 对象，不修改原始对象
    return Question(
        id=q.id,
        qtype=q.qtype,
        topic=q.topic,
        options=new_options,
        answer=new_answer,
        score=q.score,
        explanation=q.explanation,
    )
