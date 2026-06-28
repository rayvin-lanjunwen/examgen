"""PyInstaller 打包脚本 — 将 FastAPI 服务打包为独立 .exe sidecar。

用法：
    python desktop/build_sidecar.py

输出：
    desktop/src-tauri/sidecar/examgen-server.exe
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "desktop" / "src-tauri" / "sidecar"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# PyInstaller 入口 — 一个极简的 Python 脚本启动 FastAPI
entry = ROOT / "desktop" / "_server_entry.py"
entry.write_text("""
import uvicorn
uvicorn.run("examgen.web.app:app", host="127.0.0.1", port=8765, log_level="info")
""")

args = [
    sys.executable, "-m", "PyInstaller",
    "--onefile",
    "--name", "examgen-server",
    "--distpath", str(OUT_DIR),
    "--workpath", str(ROOT / "build" / "pyinstaller"),
    "--specpath", str(ROOT / "build"),
    "--noconsole",
    "--hidden-import", "jinja2",
    "--hidden-import", "markdown",
    "--hidden-import", "uvicorn.logging",
    "--hidden-import", "uvicorn.loops.auto",
    "--hidden-import", "uvicorn.protocols.http.auto",
    "--hidden-import", "examgen",
    "--hidden-import", "examgen.web",
    "--hidden-import", "examgen.web.app",
    "--hidden-import", "examgen.core",
    "--hidden-import", "examgen.core.parser",
    "--hidden-import", "examgen.core.parser_txt",
    "--hidden-import", "examgen.core.generator",
    "--hidden-import", "examgen.core.normalizer",
    "--hidden-import", "examgen.core.transformer",
    "--hidden-import", "examgen.models",
    "--add-data", f"{ROOT / 'src' / 'examgen' / 'templates'};examgen/templates",
    str(entry),
]

print(f"[build_sidecar] 正在打包: examgen-server.exe -> {OUT_DIR}")
subprocess.run(args, check=True, cwd=str(ROOT))

# 清理临时入口文件
entry.unlink(missing_ok=True)

print(f"[build_sidecar] 完成: {OUT_DIR / 'examgen-server.exe'}")
