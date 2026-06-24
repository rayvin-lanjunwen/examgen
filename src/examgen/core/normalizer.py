"""校验、补全 Question 列表中的缺失与不规范字段。"""

from dataclasses import replace
from typing import List

from examgen.models import ExamMeta, Option, Question, QuestionType
from examgen.core.parser import ParseError


def normalize_questions(questions: List[Question], meta: ExamMeta) -> List[Question]:
    """对题目列表做校验与补全，返回新的题目列表，不修改原对象。

    处理内容：
    1. score 为 None 时，填充 meta.default_score
    2. 判断题(JUDGE)无选项时，自动添加 A.正确 / B.错误
    3. 答案中小写字母统一转大写
    4. 多选题答案中的逗号分隔符移除（如 "A,B,C" → "ABC"）
    5. 验证单选答案长度=1、多选答案≥1、判断答案为A或B
    """
    result: List[Question] = []
    for q in questions:
        # 从原对象创建副本
        normalized = replace(q)

        # 1) 分值补全
        if normalized.score is None:
            normalized.score = meta.default_score

        # 2) 判断题自动补选项
        if normalized.qtype == QuestionType.JUDGE and not normalized.options:
            normalized.options = [
                Option(label="A", text="正确"),
                Option(label="B", text="错误"),
            ]

        # 3) 答案大写
        normalized.answer = normalized.answer.upper()

        # 4) 多选题移除逗号分隔符
        if normalized.qtype == QuestionType.MULTIPLE:
            normalized.answer = normalized.answer.replace(",", "")

        # 5) 答案合理性校验
        _validate_answer(normalized)

        result.append(normalized)

    return result


def _validate_answer(q: Question) -> None:
    """根据题型校验答案格式，不合理时抛出 ParseError。"""
    if q.qtype == QuestionType.SINGLE:
        if len(q.answer) != 1:
            raise ParseError(
                f"第 {q.id} 题（单选）答案长度应为 1，实际为: '{q.answer}'",
                field=f"第 {q.id} 题",
                suggestion="单选题答案应为单个大写字母，如 `A`",
            )

    elif q.qtype == QuestionType.MULTIPLE:
        if len(q.answer) < 1:
            raise ParseError(
                f"第 {q.id} 题（多选）答案不能为空",
                field=f"第 {q.id} 题",
                suggestion="多选题至少应有一个正确答案，如 `ABD`",
            )

    elif q.qtype == QuestionType.JUDGE:
        if q.answer not in ("A", "B"):
            raise ParseError(
                f"第 {q.id} 题（判断）答案应为 A 或 B，实际为: '{q.answer}'",
                field=f"第 {q.id} 题",
                suggestion="判断题答案 `A`=正确，`B`=错误",
            )
