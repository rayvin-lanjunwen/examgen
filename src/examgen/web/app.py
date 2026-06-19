"""ExamGen Web UI — FastAPI 应用。"""

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from examgen import __version__
from examgen.core.generator import generate_html
from examgen.core.normalizer import normalize_questions
from examgen.core.parser import parse_exam_text
from examgen.core.transformer import apply_transforms

# 目录
_WEB_DIR = Path(__file__).resolve().parent
_TEMPLATE_DIR = _WEB_DIR / "templates"
_STATIC_DIR = _WEB_DIR / "static"

app = FastAPI(title="ExamGen", version=__version__)
templates = Jinja2Templates(directory=str(_TEMPLATE_DIR))

# 挂载静态文件
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")


@app.on_event("startup")
async def startup():
    print("ExamGen Web UI 已启动")


@app.get("/")
async def index(request: Request):
    """渲染上传页面。"""
    return templates.TemplateResponse(
        request=request,
        name="upload.html",
        context={"version": __version__},
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

    # 返回 HTML 文件下载
    filename = "exam.html"
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
