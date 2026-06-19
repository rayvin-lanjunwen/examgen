"""Core data models for examgen."""

import json
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import List, Optional


class QuestionType(str, Enum):
    SINGLE = "single"
    MULTIPLE = "multiple"
    JUDGE = "judge"
    FILL = "fill"
    ESSAY = "essay"


@dataclass
class Option:
    label: str
    text: str


@dataclass
class Question:
    id: int
    qtype: QuestionType
    topic: str
    options: List[Option] = field(default_factory=list)
    answer: str = ""
    score: Optional[float] = None
    explanation: Optional[str] = None


@dataclass
class ExamMeta:
    title: str
    subject: Optional[str] = None
    time: Optional[int] = None
    total_score: Optional[float] = None
    default_score: float = 1.0
    shuffle: bool = False
    option_shuffle: bool = False
    passing_score: Optional[float] = None


def exam_to_json(meta: ExamMeta, questions: List[Question], **kwargs) -> str:
    """Serialize ExamMeta and a list of Questions to a JSON string."""
    data = {
        "meta": asdict(meta),
        "questions": [asdict(q) for q in questions],
    }
    return json.dumps(data, ensure_ascii=False, **kwargs)
