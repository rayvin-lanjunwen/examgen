"""一键构建桌面版 .exe 安装包

用法：
    python desktop/build_release.py

前置依赖：
    - Rust 工具链 (https://www.rust-lang.org/tools/install)
    - Node.js + npm (https://nodejs.org)
    - pip install pyinstaller

输出：
    desktop/src-tauri/target/release/bundle/msi/ExamGen_*.msi  (安装包)
    或
    desktop/src-tauri/target/release/bundle/nsis/ExamGen_*.exe  (NSIS 安装程序)
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESKTOP = ROOT / "desktop"


def run(cmd: list[str], cwd: Path | None = None, desc: str = "") -> None:
    label = f"[{desc}]" if desc else ""
    print(f"\n{label} {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=str(cwd or ROOT))


def main() -> None:
    # ============================================================
    # Step 1: 安装 ExamGen 包（确保模板文件可被打包时复制）
    # ============================================================
    run([sys.executable, "-m", "pip", "install", "-e", "."],
        desc="1/5 安装 examgen 包")

    # ============================================================
    # Step 2: 用 PyInstaller 打包 FastAPI sidecar
    # ============================================================
    run([sys.executable, str(ROOT / "desktop" / "build_sidecar.py")],
        desc="2/5 打包 FastAPI sidecar")

    # ============================================================
    # Step 3: 安装 npm 依赖
    # ============================================================
    run(["npm", "install"], cwd=DESKTOP, desc="3/5 安装 npm 依赖")

    # ============================================================
    # Step 4: 构建 Tauri 项目
    # ============================================================
    run(["npx", "tauri", "build"], cwd=DESKTOP, desc="4/5 构建 Tauri")

    # ============================================================
    # Step 5: 提示输出路径
    # ============================================================
    bundle_dir = DESKTOP / "src-tauri" / "target" / "release" / "bundle"
    msi_files = list(bundle_dir.glob("msi/*.msi"))
    nsis_files = list(bundle_dir.glob("nsis/*.exe"))

    print("\n" + "=" * 60)
    print("  构建完成！")
    print("=" * 60)
    if msi_files:
        print(f"  MSI 安装包: {msi_files[0]}")
    elif nsis_files:
        print(f"  NSIS 安装程序: {nsis_files[0]}")
    else:
        print(f"  输出目录: {bundle_dir}")
    print("\n  将此文件发给用户，双击安装即可。")
    print("  用户不需要安装 Python / Node.js / Rust。")
    print("=" * 60)


if __name__ == "__main__":
    main()
