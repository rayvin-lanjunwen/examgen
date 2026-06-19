"""腾讯云 SCF (云函数 Web 函数) 入口。

部署步骤：
1. 将整个项目目录打包为 ZIP
2. 在腾讯云 SCF 控制台创建 Web 函数，运行环境选 Python 3.9+
3. 入口函数设为 scf/index.main
4. 上传 ZIP 包

触发器配置中，API 网关会自动生成公网访问 URL。
"""

import sys
from pathlib import Path

# 将 src 目录加入 Python 路径
_SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from mangum import Mangum
from examgen.web.app import app

# Mangum 将 ASGI 应用适配为 SCF Web 函数
handler = Mangum(app)


def main(event, context):
    """SCF Web 函数入口。"""
    return handler(event, context)
