"""ExamGen Web UI — FastAPI 应用。"""

import base64
import json
import mimetypes
import re
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from examgen import __version__
from examgen.core.generator import generate_html
from examgen.core.normalizer import normalize_questions
from examgen.core.parser import ParseError, parse_exam_text
from examgen.core.transformer import apply_transforms

# 目录
_WEB_DIR = Path(__file__).resolve().parent
_TEMPLATE_DIR = _WEB_DIR / "templates"
_STATIC_DIR = _WEB_DIR / "static"
_PROJECT_ROOT = _WEB_DIR.parent.parent.parent

# Markdown 图片正则：![alt](path)
_RE_MD_IMAGE = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')


def _embed_uploaded_images(md_text: str, image_files: dict[str, bytes]) -> str:
    """将 Markdown 中的本地图片引用替换为上传图片的 base64 data URI。

    匹配规则：提取 Markdown 中 ``![alt](path)`` 的 ``path`` 部分，
    取文件名（去除目录前缀）与上传图片的文件名匹配。
    """
    def _replace(match: re.Match) -> str:
        alt_text = match.group(1)
        img_path = match.group(2)

        # 跳过网络 / data URI
        if img_path.startswith(("http://", "https://", "data:", "ftp://")):
            return match.group(0)

        # 取文件名（例如 _figures/xxx.png → xxx.png）
        img_name = Path(img_path).name

        if img_name not in image_files:
            return match.group(0)

        data = image_files[img_name]
        mime_type, _ = mimetypes.guess_type(img_name)
        if mime_type is None:
            mime_type = "image/png"
        b64 = base64.b64encode(data).decode("ascii")
        return f'![{alt_text}](data:{mime_type};base64,{b64})'

    return _RE_MD_IMAGE.sub(_replace, md_text)


# 读取示例模板
def _load_template_sample() -> str:
    sample_path = _PROJECT_ROOT / "docs" / "sample.md"
    if sample_path.exists():
        return sample_path.read_text(encoding="utf-8")
    return ""

_SAMPLE_TEMPLATE = _load_template_sample()

# 读取文档文件
def _load_doc(name: str) -> str:
    doc_path = _PROJECT_ROOT / "docs" / name
    if doc_path.exists():
        return doc_path.read_text(encoding="utf-8")
    return ""

_PROMPT_DOC = _load_doc("prompt.md")
_SPEC_DOC = _load_doc("spec.md")

app = FastAPI(title="ExamGen", version=__version__)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory=str(_TEMPLATE_DIR))

# 挂载静态文件
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")


@app.on_event("startup")
async def startup():
    print("ExamGen Web UI 已启动")


@app.get("/")
async def index(request: Request):
    """渲染上传页面。"""
    response = templates.TemplateResponse(
        request=request,
        name="upload.html",
        context={"version": __version__},
    )
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.get("/api/template")
async def template_sample():
    """返回示例模板 Markdown 内容（纯文本）。"""
    return Response(
        content=_SAMPLE_TEMPLATE,
        media_type="text/plain; charset=utf-8",
    )


@app.get("/api/prompt")
async def prompt_doc():
    """返回出卷提示词文档（纯文本）。"""
    return Response(
        content=_PROMPT_DOC,
        media_type="text/plain; charset=utf-8",
    )


@app.get("/api/spec")
async def spec_doc():
    """返回题目源文件规范文档（纯文本）。"""
    return Response(
        content=_SPEC_DOC,
        media_type="text/plain; charset=utf-8",
    )


@app.post("/generate")
async def generate(
    files: List[UploadFile] = File(...),
    title: Optional[str] = Form(None),
    time: Optional[int] = Form(None),
    shuffle: Optional[str] = Form(None),
    option_shuffle: Optional[str] = Form(None),
):
    """接收上传的 .md 文件及图片文件，生成并返回 HTML 试卷下载。

    图片按文件名与 Markdown 中的 ``![alt](path)`` 引用自动匹配：
    无论图片在 Markdown 中写的是 ``_figures/xxx.png`` 还是 ``images/xxx.png``，
    只要上传的图片文件名（如 ``xxx.png``）一致即可匹配。
    """
    # 分离 .md 文件和图片文件
    md_text = None
    image_files: dict[str, bytes] = {}

    for f in files:
        if not f.filename:
            continue
        fname_lower = f.filename.lower()
        data = await f.read()

        if fname_lower.endswith((".md", ".markdown")):
            md_text = data.decode("utf-8")
        elif fname_lower.endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")):
            # 按文件名（不含目录）存储
            image_files[Path(f.filename).name] = data

    if md_text is None:
        return JSONResponse(
            status_code=422,
            content={
                "error": True,
                "message": "未找到 .md 文件",
                "field": None,
                "suggestion": "请确保上传的文件中包含一个 .md 文件",
            },
        )

    try:
        # 将 Markdown 中的本地图片引用替换为 base64 data URI
        md_text = _embed_uploaded_images(md_text, image_files)

        # 核心流程
        meta, questions = parse_exam_text(md_text)
        questions = normalize_questions(questions, meta)

        # 命令行覆盖参数
        if title:
            meta.title = title
        if time is not None:
            meta.time = time
        if shuffle == "1":
            meta.shuffle = True
        if option_shuffle == "1":
            meta.option_shuffle = True

        questions = apply_transforms(questions, meta)
        html = generate_html(questions, meta)

    except ParseError as e:
        return JSONResponse(
            status_code=422,
            content={
                "error": True,
                "message": e.message,
                "field": e.field,
                "suggestion": e.suggestion,
            },
        )
    except Exception as e:
        return JSONResponse(
            status_code=422,
            content={
                "error": True,
                "message": f"生成失败：{e}",
                "field": None,
                "suggestion": "请检查文件格式是否符合 ExamGen 规范",
            },
        )

    # 返回 HTML 文件下载
    filename = "exam.html"
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
