"""ExamGen Web UI — FastAPI 应用。"""

import json
from pathlib import Path
from typing import Optional

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

# 读取示例模板，如果不存在则返回空串
def _load_template_sample() -> str:
    sample_path = _PROJECT_ROOT / "tests" / "fixtures" / "sample.md"
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

# CORS — 允许前端跨域调用
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
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    time: Optional[int] = Form(None),
    shuffle: Optional[str] = Form(None),
    option_shuffle: Optional[str] = Form(None),
):
    """接收上传的 .md 文件及可选参数，生成并返回 HTML 试卷下载。"""
    # 读取上传文件内容
    content = await file.read()
    md_text = content.decode("utf-8")

    try:
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
