"""测试 parser 模块的解析功能。"""

import pytest

from examgen.core.parser import ParseError, _strip_leading_backslash, parse_exam_file, parse_exam_text
from examgen.models import QuestionType

FIXTURE = "docs/sample.md"


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
        """填空题：第 5 题。"""
        _, questions = parse_exam_file(FIXTURE)
        q = questions[4]
        assert q.qtype == QuestionType.FILL
        assert q.answer == "print|format"
        assert q.score == 2.0

    def test_parse_essay(self):
        """简答题：第 6 题。"""
        _, questions = parse_exam_file(FIXTURE)
        q = questions[5]
        assert q.qtype == QuestionType.ESSAY
        assert "列表" in q.answer
        assert q.score == 5.0

    def test_question_ids_sequential(self):
        """题目 id 从 1 开始递增。"""
        _, questions = parse_exam_file(FIXTURE)
        ids = [q.id for q in questions]
        assert ids == [1, 2, 3, 4, 5, 6, 7]

    def test_explanation_parsed(self):
        """解析字段正确提取。"""
        _, questions = parse_exam_file(FIXTURE)
        assert "保留关键字" in questions[0].explanation
        assert questions[4].explanation is None  # 第 5 题（填空）无解析


class TestMissingTitle:
    def test_missing_title_raises(self, tmp_path):
        """缺少 title 时应抛出 ParseError。"""
        md = tmp_path / "no_title.md"
        md.write_text("---\nsubject: test\n---\n\n1. [单选] 题目\n- A. a\n答案：A\n", encoding="utf-8")
        with pytest.raises(ParseError, match="缺少必填字段"):
            parse_exam_file(str(md))


class TestFormulaPreservation:
    """验证数学公式在解析过程中不被破坏。"""

    def test_inline_formula_in_topic(self):
        """题干中的行内公式 $...$ 应原样保留。"""
        md = """---
title: 测试
---
#1. [单选]
#题干
设函数 $f(x) = \\sum_{i=1}^{n} x_i^2$，求最小值。
#选项
- A. 0
- B. 1
- C. -1
- D. 无穷大
#答案
A
"""
        _, questions = parse_exam_text(md)
        assert "$f(x) = \\sum_{i=1}^{n} x_i^2$" in questions[0].topic

    def test_display_formula_in_topic(self):
        """题干中的块级公式 $$...$$ 应原样保留。"""
        md = """---
title: 测试
---
#1. [简答]
#题干
求极限：
$$
\\lim_{x \\to 0} \\frac{\\sin x}{x}
$$
#答案
1
"""
        _, questions = parse_exam_text(md)
        assert "$$" in questions[0].topic
        assert "\\lim_{x \\to 0}" in questions[0].topic

    def test_formula_in_explanation(self):
        """解析中的公式应原样保留。"""
        md = """---
title: 测试
---
#1. [单选]
#题干
问题
#选项
- A. a
- B. b
#答案
A
#解析
因为 $\\frac{a}{b} = c$，所以选 A。
"""
        _, questions = parse_exam_text(md)
        assert "$\\frac{a}{b} = c$" in questions[0].explanation

    def test_formula_in_answer(self):
        """答案中的公式应原样保留。"""
        md = """---
title: 测试
---
#1. [简答]
#题干
问题
#答案
根据公式 $E = mc^2$，可得...
"""
        _, questions = parse_exam_text(md)
        assert "$E = mc^2$" in questions[0].answer

    def test_strip_backslash_preserves_latex_display(self):
        """_strip_leading_backslash 不应破坏 LaTeX \\[ \\] 定界符。"""
        line = "\\[ \\frac{a}{b} = c \\]"
        result = _strip_leading_backslash(line)
        assert "\\[" in result  # 公式含 LaTeX 命令，应保留
        assert "\\]" in result
        assert "\\frac" in result

    def test_strip_backslash_strips_ai_escape_at_line_start(self):
        """行首的 AI 转义 \\[ \\] 应被去除。"""
        line = "\\[选项\\]"
        result = _strip_leading_backslash(line)
        assert result == "[选项]"
