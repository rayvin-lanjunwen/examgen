# ExamGen 桌面版

基于 Tauri + FastAPI 的离线试卷生成器 Windows 桌面客户端。

## 架构

```
desktop/
├── public/
│   └── index.html          # Tauri WebView 入口（加载 FastAPI 页面）
├── src-tauri/
│   ├── src/main.rs         # Rust 主程序 — 启动 sidecar + 创建窗口
│   ├── tauri.conf.json     # Tauri 配置
│   ├── Cargo.toml          # Rust 依赖
│   ├── capabilities/       # Tauri v2 权限
│   └── sidecar/            # PyInstaller 打包的 FastAPI .exe（构建产物）
├── build_sidecar.py        # PyInstaller 打包脚本
├── build_release.py        # 一键构建（推荐）
└── package.json            # npm 脚本（tauri CLI）
```

## 一键构建（推荐）

```bash
# 前置条件：安装 Rust + Node.js
# https://www.rust-lang.org/tools/install
# https://nodejs.org

pip install pyinstaller
python desktop/build_release.py
```

构建完成后，在 `desktop/src-tauri/target/release/bundle/` 目录下找到 `.msi` 安装包。

## 分步构建

### 1. 安装 Rust 和 Tauri CLI

```bash
# Rust
https://www.rust-lang.org/tools/install

# Tauri CLI
npm install -g @tauri-apps/cli
```

### 2. 打包 Python sidecar

```bash
pip install pyinstaller
python desktop/build_sidecar.py
```

### 3. 构建安装包

```bash
cd desktop
npm install
npx tauri build
```

输出文件：`desktop/src-tauri/target/release/bundle/msi/ExamGen_*.msi`

### 开发模式

```bash
cd desktop
npm install
npx tauri dev
```

开发模式下 Tauri 直接调用 `python -m uvicorn`，无需打包 sidecar。

## 分发说明

### 发给用户只需要一个文件

构建后的 `.msi` 安装包是完全自包含的：

- 用户 **不需要** 安装 Python
- 用户 **不需要** 安装 Node.js / Rust
- 用户 **不需要** 联网（生成的试卷 HTML 也是离线可用的）

### 安装后用户看到什么

1. 双击 `.msi` → 安装到 `C:\Program Files\ExamGen\`
2. 双击桌面快捷方式 `ExamGen` → 打开窗口
3. 界面就是现在的上传页面（拖拽 .md / .txt 生成试卷）
4. 生成的试卷 HTML 保存到本地任意位置
5. 生成的 HTML 文件可以发给学生，学生双击在浏览器打开即可做题

### 内部原理

```
用户双击 ExamGen.exe
  → Tauri 创建窗口
  → 后台启动 examgen-server.exe (PyInstaller 打包的 FastAPI)
  → WebView 加载 http://127.0.0.1:8765
  → 显示上传页面（和网页版完全一样）
  → 用户上传文件、选择参数、下载试卷
  → 试卷保存到本地 → 完成
```
