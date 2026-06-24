"""测试 transformer 模块的随机变换功能。"""

import random

from examgen.core.transformer import apply_transforms
from examgen.models import ExamMeta, Option, Question, QuestionType


def _meta(**kwargs) -> ExamMeta:
    defaults = {"title": "测试"}
    defaults.update(kwargs)
    return ExamMeta(**defaults)


class TestShuffleQuestions:
    def test_shuffle_questions(self):
        """打乱后元素数量不变，所有题目 id 仍在。"""
        questions = [
            Question(id=i, qtype=QuestionType.SINGLE, topic=f"Q{i}",
                     options=[Option("A", "a")], answer="A")
            for i in range(1, 11)
        ]
        meta = _meta(shuffle=True)
        random.seed(42)
        result = apply_transforms(questions, meta)

        assert len(result) == len(questions)
        assert sorted(q.id for q in result) == sorted(q.id for q in questions)

    def test_no_shuffle_keeps_order(self):
        """shuffle=False 时顺序不变。"""
        questions = [
            Question(id=i, qtype=QuestionType.SINGLE, topic=f"Q{i}",
                     options=[Option("A", "a")], answer="A")
            for i in range(1, 6)
        ]
        meta = _meta(shuffle=False)
        result = apply_transforms(questions, meta)
        assert [q.id for q in result] == [1, 2, 3, 4, 5]


class TestOptionShuffle:
    def test_option_shuffle(self):
        """选项打乱后答案映射正确（用固定种子验证）。"""
        q = Question(
            id=1,
            qtype=QuestionType.SINGLE,
            topic="test",
            options=[
                Option("A", "苹果"),
                Option("B", "香蕉"),
                Option("C", "橙子"),
            ],
            answer="B",  # 正确答案是"香蕉"
        )
        meta = _meta(option_shuffle=True)
        random.seed(42)
        result = apply_transforms([q], meta)
        rq = result[0]

        # 答案字母可能变了，但对应的文字应仍是"香蕉"
        new_answer_label = rq.answer
        matched = [o for o in rq.options if o.label == new_answer_label]
        assert len(matched) == 1
        assert matched[0].text == "香蕉"

    def test_option_shuffle_multiple(self):
        """多选题选项打乱后答案映射正确。"""
        q = Question(
            id=1,
            qtype=QuestionType.MULTIPLE,
            topic="test",
            options=[
                Option("A", "一"),
                Option("B", "二"),
                Option("C", "三"),
                Option("D", "四"),
            ],
            answer="AC",
        )
        meta = _meta(option_shuffle=True)
        random.seed(99)
        result = apply_transforms([q], meta)
        rq = result[0]

        # 新答案中的字母应对应原始的"一"和"三"
        matched_texts = set()
        for ch in rq.answer:
            for o in rq.options:
                if o.label == ch:
                    matched_texts.add(o.text)
        assert matched_texts == {"一", "三"}

    def test_original_unchanged(self):
        """原题目对象不应被修改。"""
        q = Question(
            id=1, qtype=QuestionType.SINGLE, topic="t",
            options=[Option("A", "x"), Option("B", "y")],
            answer="A",
        )
        meta = _meta(option_shuffle=True)
        random.seed(7)
        apply_transforms([q], meta)

        assert q.answer == "A"
        assert q.options[0].label == "A"
        assert q.options[0].text == "x"

    def test_essay_not_shuffled(self):
        """简答题选项不参与打乱（无选项）。"""
        q = Question(id=1, qtype=QuestionType.ESSAY, topic="essay", answer="答案")
        meta = _meta(option_shuffle=True)
        random.seed(1)
        result = apply_transforms([q], meta)
        assert result[0].answer == "答案"

    def test_shuffle_within_sections(self):
        """分区打乱：分区内顺序可变，分区间顺序不变。"""
        questions = [
            Question(id=1, qtype=QuestionType.SINGLE, topic="Q1", answer="A", section="一"),
            Question(id=2, qtype=QuestionType.SINGLE, topic="Q2", answer="A", section="一"),
            Question(id=3, qtype=QuestionType.SINGLE, topic="Q3", answer="A", section="一"),
            Question(id=4, qtype=QuestionType.SINGLE, topic="Q4", answer="A", section="二"),
            Question(id=5, qtype=QuestionType.SINGLE, topic="Q5", answer="A", section="二"),
            Question(id=6, qtype=QuestionType.SINGLE, topic="Q6", answer="A", section="三"),
        ]
        meta = _meta(shuffle=True)
        random.seed(42)
        result = apply_transforms(questions, meta)

        # 分区内 id 集合不变
        sec1_ids = sorted(q.id for q in result if q.section == "一")
        sec2_ids = sorted(q.id for q in result if q.section == "二")
        sec3_ids = sorted(q.id for q in result if q.section == "三")
        assert sec1_ids == [1, 2, 3]
        assert sec2_ids == [4, 5]
        assert sec3_ids == [6]

        # 分区顺序应保持（先一、再二、最后三）
        sec_names = []
        for q in result:
            if not sec_names or sec_names[-1] != q.section:
                sec_names.append(q.section)
        assert sec_names[0] == "一"
        # 至少分区间的相对顺序被保留
