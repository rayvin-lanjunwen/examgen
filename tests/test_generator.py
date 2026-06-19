"""测试 generator 模块的 HTML 生成与文件写入。"""

from pathlib import Path

from examgen.core.generator import generate_html, save_exam
from examgen.models import ExamMeta, Option, Question, QuestionType


def _sample():
    meta = ExamMeta(title="测试试卷", subject="数学", time=60, total_score=10)
    questions = [
        Question(
            id=1, qtype=QuestionType.SINGLE, topic="1+1=?",
            options=[Option("A", "1"), Option("B", "2"), Option("C", "3")],
            answer="B", score=5.0,
        ),
        Question(
            id=2, qtype=QuestionType.FILL, topic="圆周率约等于 ____",
            answer="3.14", score=5.0,
        ),
    ]
    return meta, questions


class TestGenerateHtml:
    def test_generate_html_contains_title(self):
        """生成的 HTML 应包含试卷标题。"""
        meta, questions = _sample()
        html = generate_html(questions, meta)
        assert "测试试卷" in html

    def test_contains_subject(self):
        """HTML 中包含科目信息。"""
        meta, questions = _sample()
        html = generate_html(questions, meta)
        assert "数学" in html

    def test_contains_js_data(self):
        """HTML 中嵌入了题目数据变量。"""
        meta, questions = _sample()
        html = generate_html(questions, meta)
        assert "EXAM_DATA" in html
        assert "EXAM_META" in html

    def test_contains_css(self):
        """HTML 中内联了 CSS。"""
        meta, questions = _sample()
        html = generate_html(questions, meta)
        assert ":root" in html  # CSS 变量声明

    def test_contains_js_logic(self):
        """HTML 中内联了 JS。"""
        meta, questions = _sample()
        html = generate_html(questions, meta)
        assert "renderQuestions" in html


class TestSaveExam:
    def test_save_exam(self, tmp_path):
        """写入文件并验证存在。"""
        meta, questions = _sample()
        html = generate_html(questions, meta)
        out = tmp_path / "exam.html"
        save_exam(html, str(out))
        assert out.exists()
        assert out.read_text(encoding="utf-8") == html

    def test_save_creates_dirs(self, tmp_path):
        """save_exam 能自动创建中间目录。"""
        out = tmp_path / "sub" / "dir" / "exam.html"
        save_exam("<h1>hi</h1>", str(out))
        assert out.exists()
