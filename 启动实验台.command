#!/bin/zsh
# Double-click on macOS. Keep this terminal open while using the workbench.
set -e
cd "${0:A:h}"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  print '没有找到 Node.js，请先安装 Node.js 22.12 或更新版本。'
  read '?按回车关闭…'
  exit 1
fi
if /usr/bin/curl -fsS --max-time 2 http://127.0.0.1:5173/ 2>/dev/null | /usr/bin/grep -q 'WireBench'; then
  open 'http://127.0.0.1:5173/'
  exit 0
fi
if [[ ! -d node_modules ]]; then
  print '首次启动，正在安装项目依赖…'
  npm ci
fi
print '实验台即将打开。使用期间请保留此窗口；按 Control+C 可停止。'
npm run dev -- --open
