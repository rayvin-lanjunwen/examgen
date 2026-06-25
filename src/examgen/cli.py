"""CLI 入口，基于 click 框架。"""

import os

import click

from examgen import __version__
from examgen.core.generator import generate_html, save_exam
from examgen.core.normalizer import normalize_questions
from examgen.core.parser import parse_exam_file
from examgen.core.transformer import apply_transforms


@click.group()
@click.version_option(version=__version__, prog_name="examgen")
def main():
    """examgen — 从 Markdown 生成离线 HTML 试卷。"""
    pass


@main.command()
@click.argument("input", type=click.Path(exists=True, dir_okay=False))
@click.option("-o", "--output", default="exam.html", show_default=True,
              help="输出 HTML 文件路径。")
@click.option("--shuffle/--no-shuffle", default=None,
              help="覆盖：是否随机打乱题目顺序（默认跟随 Markdown 元数据）。")
@click.option("--option-shuffle/--no-option-shuffle", default=None,
              help="覆盖：是否随机打乱选项顺序。")
@click.option("--time", type=int, default=None,
              help="覆盖：考试时间（分钟）。")
@click.option("--template-dir", type=click.Path(exists=True, file_okay=False),
              default=None, help="自定义模板目录。")
def generate(input, output, shuffle, option_shuffle, time, template_dir):
    """从 Markdown 文件生成离线 HTML 试卷。"""
    # 1. 解析
    meta, questions = parse_exam_file(input)

    # 2. 校验 & 补全
    questions = normalize_questions(questions, meta)

    # 3. 命令行覆盖 meta
    if shuffle is not None:
        meta.shuffle = shuffle
    if option_shuffle is not None:
        meta.option_shuffle = option_shuffle
    if time is not None:
        meta.time = time

    # 4. 随机变换
    questions = apply_transforms(questions, meta)

    # 5. 渲染 HTML（自动嵌入本地图片）
    html = generate_html(questions, meta, template_dir=template_dir,
                         content_dir=os.path.dirname(input))

    # 6. 写入文件
    save_exam(html, output)

    # 7. 输出信息
    size = os.path.getsize(output)
    click.echo(f"已生成: {output}  ({size:,} bytes)")


@main.command()
@click.option("--host", default="127.0.0.1", show_default=True, help="绑定地址。")
@click.option("--port", default=8080, show_default=True, help="绑定端口。")
@click.option("--reload", is_flag=True, default=False, help="启用热重载（开发用）。")
def web(host, port, reload):
    """启动 Web 可视化界面。"""
    import uvicorn
    click.echo(f"启动 ExamGen Web UI: http://{host}:{port}")
    uvicorn.run("examgen.web.app:app", host=host, port=port, reload=reload)
