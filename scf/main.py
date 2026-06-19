"""腾讯云 SCF Web 函数入口。

启动命令：python -m uvicorn main:app --host 0.0.0.0 --port 9000
"""

import sys
from pathlib import Path

# 将 src 目录加入 Python 路径
_SRC = Path(__file__).resolve().parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

# 导出 FastAPI app 实例，供 uvicorn 启动
from examgen.web.app import app  # noqa: E402, F401
