"""测试 parser 模块的解析功能。"""

import pytest

from examgen.core.parser import parse_exam_file
from examgen.models import QuestionType

FIXTURE = "tests/fixtures/sample.md"


class TestParseMeta:
    def test_parse_meta(self):
        """验证 ExamMeta 字段正确解析。"""
        meta, _ = parse_exam_file(FIXTURE)
        assert meta.title == "期末考试样卷"
        assert meta.subject == "计算机科学"
        assert meta.time == 90
        assert meta.total_score == 100.0
        assert meta.default_score == 2.0
        assert meta.shuffle is False
        assert meta.option_shuffle is False
        assert meta.passing_score == 60.0


class TestParseQuestions:
    def test_parse_single_choice(self):
        """单选题：4 个选项，答案 A。"""
        _, questions = parse_exam_file(FIXTURE)
        q = questions[0]
        assert q.qtype == QuestionType.SINGLE
        assert len(q.options) == 4
        assert q.options[0].label == "A"
        assert q.options[0].text == "class"
        assert q.answer == "A"
        assert q.score == 2.0

    def test_parse_multiple_choice(self):
        """多选题：4 个选项，答案含逗号。"""
        _, questions = parse_exam_file(FIXTURE)
        q = questions[1]
        assert q.qtype == QuestionType.MULTIPLE
        assert len(q.options) == 4
        assert q.answer == "A,B,D"
        assert q.score == 3.0

    def test_parse_judge(self):
        """判断题：无显式选项（后续 normalizer 补全），答案 A。"""
        _, questions = parse_exam_file(FIXTURE)
        q = questions[2]
        assert q.qtype == QuestionType.JUDGE
        assert q.answer == "A"
        assert q.score == 2.0

    def test_parse_fill(self):
        """填空题。"""
        _, questions = parse_exam_file(FIXTURE)
        q = questions[3]
        assert q.qtype == QuestionType.FILL
        assert q.answer == "print"
        assert q.score == 2.0

    def test_parse_essay(self):
        """简答题。"""
        _, questions = parse_exam_file(FIXTURE)
        q = questions[4]
        assert q.qtype == QuestionType.ESSAY
        assert "列表" in q.answer
        assert q.score == 5.0

    def test_question_ids_sequential(self):
        """题目 id 从 1 开始递增。"""
        _, questions = parse_exam_file(FIXTURE)
        ids = [q.id for q in questions]
        assert ids == [1, 2, 3, 4, 5]

    def test_explanation_parsed(self):
        """解析字段正确提取。"""
        _, questions = parse_exam_file(FIXTURE)
        assert "保留关键字" in questions[0].explanation
        assert questions[3].explanation is None  # 填空题无解析


class TestMissingTitle:
    def test_missing_title_raises(self, tmp_path):
        """缺少 title 时应抛出 ValueError。"""
        md = tmp_path / "no_title.md"
        md.write_text("---\nsubject: test\n---\n\n1. [单选] 题目\n- A. a\n答案：A\n", encoding="utf-8")
        with pytest.raises(ValueError, match="title"):
            parse_exam_file(str(md))
