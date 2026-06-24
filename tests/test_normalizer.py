"""测试 normalizer 模块的校验与补全功能。"""

import pytest

from examgen.core.normalizer import normalize_questions
from examgen.core.parser import ParseError
from examgen.models import ExamMeta, Option, Question, QuestionType


def _meta(**kwargs) -> ExamMeta:
    defaults = {"title": "测试", "default_score": 2.0}
    defaults.update(kwargs)
    return ExamMeta(**defaults)


class TestDefaultScore:
    def test_default_score(self):
        """score 为 None 时应填充 meta.default_score。"""
        q = Question(id=1, qtype=QuestionType.SINGLE, topic="t", answer="A",
                     options=[Option("A", "a")], score=None)
        result = normalize_questions([q], _meta())
        assert result[0].score == 2.0

    def test_existing_score_kept(self):
        """已有分值不被覆盖。"""
        q = Question(id=1, qtype=QuestionType.SINGLE, topic="t", answer="A",
                     options=[Option("A", "a")], score=5.0)
        result = normalize_questions([q], _meta())
        assert result[0].score == 5.0


class TestJudgeOptions:
    def test_judge_options_auto(self):
        """判断题无选项时自动添加 A.正确 / B.错误。"""
        q = Question(id=1, qtype=QuestionType.JUDGE, topic="t", answer="A")
        result = normalize_questions([q], _meta())
        assert len(result[0].options) == 2
        assert result[0].options[0].label == "A"
        assert result[0].options[0].text == "正确"
        assert result[0].options[1].label == "B"
        assert result[0].options[1].text == "错误"

    def test_judge_options_not_overwritten(self):
        """判断题已有选项时不覆盖。"""
        q = Question(id=1, qtype=QuestionType.JUDGE, topic="t", answer="A",
                     options=[Option("A", "对"), Option("B", "错")])
        result = normalize_questions([q], _meta())
        assert result[0].options[0].text == "对"


class TestAnswerNormalization:
    def test_answer_uppercase(self):
        """答案小写转大写。"""
        q = Question(id=1, qtype=QuestionType.SINGLE, topic="t", answer="a",
                     options=[Option("A", "x")])
        result = normalize_questions([q], _meta())
        assert result[0].answer == "A"

    def test_multiple_choice_remove_commas(self):
        """多选题答案逗号分隔符移除。"""
        q = Question(id=1, qtype=QuestionType.MULTIPLE, topic="t", answer="A,B,C",
                     options=[Option("A", "a"), Option("B", "b"), Option("C", "c")])
        result = normalize_questions([q], _meta())
        assert result[0].answer == "ABC"

    def test_fill_answer_uppercase(self):
        """填空题答案也会被大写（如变量名）。"""
        q = Question(id=1, qtype=QuestionType.FILL, topic="t", answer="print")
        result = normalize_questions([q], _meta())
        assert result[0].answer == "PRINT"


class TestInvalidAnswer:
    def test_single_choice_too_long(self):
        """单选题答案长度不为 1 时抛出异常。"""
        q = Question(id=1, qtype=QuestionType.SINGLE, topic="t", answer="AB",
                     options=[Option("A", "a"), Option("B", "b")])
        with pytest.raises(ParseError, match="第 1 题"):
            normalize_questions([q], _meta())

    def test_multiple_choice_empty(self):
        """多选题答案为空时抛出异常。"""
        q = Question(id=2, qtype=QuestionType.MULTIPLE, topic="t", answer="",
                     options=[Option("A", "a")])
        with pytest.raises(ParseError, match="第 2 题"):
            normalize_questions([q], _meta())

    def test_judge_invalid_answer(self):
        """判断题答案非 A 或 B 时抛出异常。"""
        q = Question(id=3, qtype=QuestionType.JUDGE, topic="t", answer="C")
        with pytest.raises(ParseError, match="第 3 题"):
            normalize_questions([q], _meta())
