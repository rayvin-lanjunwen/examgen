"""使用 Jinja2 将题目数据渲染为独立的离线 HTML 文件。"""

from dataclasses import asdict
from pathlib import Path
from typing import List, Optional

from jinja2 import Environment, FileSystemLoader

from examgen.models import ExamMeta, Question

# 默认模板目录：包内 templates/default/
_DEFAULT_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "default"


def generate_html(
    questions: List[Question],
    meta: ExamMeta,
    template_dir: Optional[str] = None,
) -> str:
    """渲染试卷为完整独立的 HTML 字符串。

    Parameters
    ----------
    questions : List[Question]
        已经过 normalizer / transformer 处理的题目列表。
    meta : ExamMeta
        试卷元信息。
    template_dir : str or None
        自定义模板目录路径。为 None 时使用包内默认模板。

    Returns
    -------
    str
        完整可离线运行的 HTML 字符串。
    """
    tpl_dir = Path(template_dir) if template_dir else _DEFAULT_TEMPLATE_DIR

    env = Environment(
        loader=FileSystemLoader(str(tpl_dir)),
        autoescape=True,
    )
    template = env.get_template("exam.html")

    # 读取 CSS / JS 文件内容，内联到 HTML 中
    style_content = _read_asset(tpl_dir / "assets" / "style.css")
    script_content = _read_asset(tpl_dir / "assets" / "script.js")

    # 准备模板变量
    meta_dict = asdict(meta)
    questions_data = [asdict(q) for q in questions]

    html = template.render(
        meta=meta,
        meta_dict=meta_dict,
        questions=questions_data,
        style_content=style_content,
        script_content=script_content,
    )
    return html


def save_exam(html: str, output_path: str) -> None:
    """将渲染好的 HTML 字符串写入文件。

    Parameters
    ----------
    html : str
        完整的 HTML 字符串。
    output_path : str
        输出文件路径。
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")


def _read_asset(path: Path) -> str:
    """读取资源文件内容，不存在时返回空字符串。"""
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""
