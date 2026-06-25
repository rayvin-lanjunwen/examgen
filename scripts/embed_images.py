"""将 Markdown 中的本地图片引用嵌入为 base64 data URI，使 .md 文件自包含。"""

import base64
import mimetypes
import re
import sys
from pathlib import Path

_RE_IMAGE = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')


def embed_images(md_path: str) -> str:
    """读取 .md 文件，将本地图片嵌入为 data URI，返回新内容。"""
    path = Path(md_path)
    base_dir = path.parent
    content = path.read_text(encoding="utf-8")

    def _replace(match: re.Match) -> str:
        alt_text = match.group(1)
        img_path = match.group(2)

        # 跳过网络 / data URI
        if img_path.startswith(("http://", "https://", "data:", "ftp://")):
            return match.group(0)

        candidate = (base_dir / img_path).resolve()
        if not candidate.exists():
            print(f"  [跳过] 找不到文件: {candidate}")
            return match.group(0)

        mime_type, _ = mimetypes.guess_type(str(candidate))
        if mime_type is None:
            mime_type = "image/png"
        data = candidate.read_bytes()
        b64 = base64.b64encode(data).decode("ascii")
        size_kb = len(data) / 1024
        print(f"  [嵌入] {img_path} ({size_kb:.0f} KB)")
        return f'![{alt_text}](data:{mime_type};base64,{b64})'

    return _RE_IMAGE.sub(_replace, content)


def main():
    if len(sys.argv) < 2:
        print("用法: python embed_images.py <markdown文件.md>")
        sys.exit(1)

    md_path = sys.argv[1]
    if not Path(md_path).exists():
        print(f"错误: 文件不存在: {md_path}")
        sys.exit(1)

    print(f"处理: {md_path}")
    new_content = embed_images(md_path)

    out_path = Path(md_path)
    out_path.write_text(new_content, encoding="utf-8")
    print(f"完成! 已更新: {out_path}")


if __name__ == "__main__":
    main()
