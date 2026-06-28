"""使用 Jinja2 将题目数据渲染为独立的离线 HTML 文件。"""

import base64
import logging
import mimetypes
import re
from dataclasses import asdict
from pathlib import Path
from typing import List, Optional

from jinja2 import Environment, FileSystemLoader

from examgen.models import ExamMeta, Question

_logger = logging.getLogger(__name__)

# 默认模板目录：包内 templates/default/
_DEFAULT_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "default"

# Markdown 图片正则：![alt](path)
_RE_MD_IMAGE = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')


def _embed_local_images(text: str, base_dir: Path) -> str:
    """将 Markdown 文本中的本地图片引用转换为 base64 data URI。

    只处理相对路径和绝对路径的图片（排除 http/https/data URI），
    读取图片文件后嵌入为 data URI，使 HTML 完全自包含。
    """
    if not text or not base_dir or not base_dir.is_dir():
        return text

    def _replace(match: re.Match) -> str:
        alt_text = match.group(1)
        img_path = match.group(2)

        # 只处理本地文件路径
        if img_path.startswith(("http://", "https://", "data:", "ftp://")):
            return match.group(0)

        # 尝试解析图片文件路径
        candidate = (base_dir / img_path).resolve()
        if not candidate.exists():
            # 尝试在基目录下递归查找文件名
            try:
                candidates = list(base_dir.rglob(candidate.name))
                if candidates:
                    candidate = candidates[0]
                else:
                    _logger.warning("图片文件未找到，保留原始引用: %s", img_path)
                    return match.group(0)
            except Exception:
                _logger.warning("搜索图片文件时出错，保留原始引用: %s", img_path)
                return match.group(0)

        try:
            mime_type, _ = mimetypes.guess_type(str(candidate))
            if mime_type is None:
                mime_type = "image/png"
            data = candidate.read_bytes()
            b64 = base64.b64encode(data).decode("ascii")
            return f'![{alt_text}](data:{mime_type};base64,{b64})'
        except Exception:
            _logger.warning("图片读取/编码失败，保留原始引用: %s", img_path)
            return match.group(0)

    return _RE_MD_IMAGE.sub(_replace, text)


def generate_html(
    questions: List[Question],
    meta: ExamMeta,
    theme: str = "modern",
    mode: str = "exam",
    template_dir: Optional[str] = None,
    content_dir: Optional[str] = None,
) -> str:
    """渲染试卷为完整独立的 HTML 字符串。

    Parameters
    ----------
    questions : List[Question]
        已经过 normalizer / transformer 处理的题目列表。
    meta : ExamMeta
        试卷元信息。
    theme : str
        视觉主题 (modern / academic / tool / green)。
    mode : str
        试卷模式 (exam 考试模式 / challenge 闯关模式)。
    template_dir : str or None
        自定义模板目录路径。为 None 时使用包内默认模板。
    content_dir : str or None
        原始 Markdown 文件所在目录。提供后可自动将 Markdown 中
        引用的本地图片（如 ``_figures/xxx.png``）嵌入为 base64，
        使生成的 HTML 完全自包含。

    Returns
    -------
    str
        完整可离线运行的 HTML 字符串。
    """
    tpl_dir = Path(template_dir) if template_dir else _DEFAULT_TEMPLATE_DIR

    # 将本地图片嵌入为 base64 data URI
    if content_dir:
        base_dir = Path(content_dir).resolve()
        for q in questions:
            if q.topic:
                q.topic = _embed_local_images(q.topic, base_dir)
            if q.answer:
                q.answer = _embed_local_images(q.answer, base_dir)
            if q.explanation:
                q.explanation = _embed_local_images(q.explanation, base_dir)
            for opt in q.options:
                if opt.text:
                    opt.text = _embed_local_images(opt.text, base_dir)

    env = Environment(
        loader=FileSystemLoader(str(tpl_dir)),
        autoescape=True,
    )

    # 根据模式选择模板
    if mode == "challenge":
        template = env.get_template("challenge.html")
        style_content = _read_asset(tpl_dir / "assets" / "style.css")
        challenge_css = _read_asset(tpl_dir / "assets" / "challenge.css")
        # 闯关模式：跳过考试专用的 init 和 grading 模块
        challenge_skip = frozenset({"07_init.js", "08_grading.js"})
        script_content = _read_js_bundle(tpl_dir / "assets", skip=challenge_skip)
    else:
        template = env.get_template("exam.html")
        style_content = _read_asset(tpl_dir / "assets" / "style.css")
        challenge_css = ""
        # 考试模式：跳过闯关专用 JS
        exam_skip = frozenset({"10_challenge.js"})
        script_content = _read_js_bundle(tpl_dir / "assets", skip=exam_skip)

    # 准备模板变量
    meta_dict = asdict(meta)
    questions_data = [asdict(q) for q in questions]

    html = template.render(
        meta=meta,
        meta_dict=meta_dict,
        questions=questions_data,
        style_content=style_content,
        challenge_css=challenge_css,
        script_content=script_content,
        theme=theme,
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


def _read_js_bundle(assets_dir: Path, skip: frozenset[str] | None = None) -> str:
    """读取 assets/js/ 目录下所有 .js 文件并合并。

    优先从 ``assets/js/*.js`` 读取（按文件名排序拼接）；
    若目录不存在则回退到 ``assets/script.js`` 单文件模式。

    Parameters
    ----------
    skip : frozenset[str] or None
        需要跳过的文件名集合（仅对比文件名，不含路径）。
    """
    js_dir = assets_dir / "js"
    if js_dir.is_dir():
        parts: list[str] = []
        for f in sorted(js_dir.glob("*.js")):
            if skip and f.name in skip:
                continue
            parts.append(f.read_text(encoding="utf-8"))
        return "\n".join(parts)

    # 回退兼容：旧的单文件模式
    legacy = assets_dir / "script.js"
    if legacy.exists():
        return legacy.read_text(encoding="utf-8")
    return ""
