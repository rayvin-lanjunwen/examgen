"""校验、补全 Question 列表中的缺失与不规范字段。"""

from typing import List

from examgen.models import ExamMeta, Option, Question, QuestionType


def normalize_questions(questions: List[Question], meta: ExamMeta) -> List[Question]:
    """对题目列表做就地校验与补全。

    处理内容：
    1. score 为 None 时，填充 meta.default_score
    2. 判断题(JUDGE)无选项时，自动添加 A.正确 / B.错误
    3. 答案中小写字母统一转大写
    4. 多选题答案中的逗号分隔符移除（如 "A,B,C" → "ABC"）
    5. 验证单选答案长度=1、多选答案≥1、判断答案为A或B
    """
    for q in questions:
        # 1) 分值补全
        if q.score is None:
            q.score = meta.default_score

        # 2) 判断题自动补选项
        if q.qtype == QuestionType.JUDGE and not q.options:
            q.options = [
                Option(label="A", text="正确"),
                Option(label="B", text="错误"),
            ]

        # 3) 答案大写
        q.answer = q.answer.upper()

        # 4) 多选题移除逗号分隔符
        if q.qtype == QuestionType.MULTIPLE:
            q.answer = q.answer.replace(",", "")

        # 5) 答案合理性校验
        _validate_answer(q)

    return questions


def _validate_answer(q: Question) -> None:
    """根据题型校验答案格式，不合理时抛出 ValueError。"""
    if q.qtype == QuestionType.SINGLE:
        if len(q.answer) != 1:
            raise ValueError(
                f"第 {q.id} 题（单选）答案长度应为 1，实际为: '{q.answer}'"
            )

    elif q.qtype == QuestionType.MULTIPLE:
        if len(q.answer) < 1:
            raise ValueError(
                f"第 {q.id} 题（多选）答案不能为空"
            )

    elif q.qtype == QuestionType.JUDGE:
        if q.answer not in ("A", "B"):
            raise ValueError(
                f"第 {q.id} 题（判断）答案应为 A 或 B，实际为: '{q.answer}'"
            )
