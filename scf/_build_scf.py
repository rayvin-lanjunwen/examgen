"""构建 SCF 部署 ZIP 包。

运行方式：python scf/_build_scf.py
生成文件：examgen-scf.zip（在项目根目录）

ZIP 结构：
  main.py               ← 入口（根目录）
  scf_bootstrap           ← 启动脚本（兜底）
  src/examgen/...
  所有 pip 依赖...
"""

import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD_DIR = ROOT / "_scf_build"
ZIP_PATH = ROOT / "examgen-scf.zip"

# main.py — 放在 ZIP 根目录，uvicorn 直接启动
MAIN_PY = '''"""腾讯云 SCF Web 函数入口。

启动命令：python -m uvicorn main:app --host 0.0.0.0 --port 9000
"""

import sys
from pathlib import Path

# 将 src 目录加入 Python 路径
_SRC = Path(__file__).resolve().parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

# 导出 FastAPI app 实例
from examgen.web.app import app  # noqa: E402, F401
'''

# scf_bootstrap — 兜底启动脚本（必须用 LF 行尾）
BOOTSTRAP = '#!/bin/bash\npython -m uvicorn main:app --host 0.0.0.0 --port 9000\n'


def _add_to_zip(zf, arcname, data_or_path):
    """写入 ZIP，并为 scf_bootstrap 设置 Unix 可执行权限。"""
    info = zipfile.ZipInfo(arcname)
    if arcname == "scf_bootstrap":
        info.external_attr = 0o755 << 16  # 可执行权限
    else:
        info.external_attr = 0o644 << 16
    if isinstance(data_or_path, bytes):
        zf.writestr(info, data_or_path)
    else:
        with open(data_or_path, "rb") as f:
            zf.writestr(info, f.read())


def build():
    # 清理
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    BUILD_DIR.mkdir()

    # 1. 写入 main.py
    (BUILD_DIR / "main.py").write_text(MAIN_PY, encoding="utf-8")

    # 2. 写入 scf_bootstrap（LF 行尾，直接写 bytes）
    bootstrap_path = BUILD_DIR / "scf_bootstrap"
    bootstrap_path.write_bytes(BOOTSTRAP.encode("utf-8"))

    # 3. 复制 src/examgen（排除 __pycache__ 和 .egg-info）
    src_dst = BUILD_DIR / "src" / "examgen"
    src_src = ROOT / "src" / "examgen"
    shutil.copytree(
        src_src,
        src_dst,
        ignore=shutil.ignore_patterns("__pycache__", "*.egg-info"),
    )

    # 4. 下载所有依赖到 BUILD_DIR
    print("正在下载依赖...")
    req_file = ROOT / "requirements.txt"
    subprocess.run(
        [
            sys.executable, "-m", "pip", "install",
            "-r", str(req_file),
            "-t", str(BUILD_DIR),
            "--quiet",
        ],
        check=True,
    )

    # 5. 打包 ZIP（使用 _add_to_zip 确保权限正确）
    print("正在打包...")
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in sorted(BUILD_DIR.rglob("*")):
            if file.is_file():
                arcname = file.relative_to(BUILD_DIR)
                _add_to_zip(zf, str(arcname), file)

    # 6. 清理临时目录
    shutil.rmtree(BUILD_DIR)

    size_mb = ZIP_PATH.stat().st_size / (1024 * 1024)
    print(f"\n已生成: {ZIP_PATH.name} ({size_mb:.1f} MB)")
    print(f"启动命令: python -m uvicorn main:app --host 0.0.0.0 --port 9000")


if __name__ == "__main__":
    build()
