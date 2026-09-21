#!/usr/bin/env bash
# ==============================================================================
# OpenFic (仓颉 · AI 小说工坊) 一键便捷启动与进程管理脚本
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
RUN_DIR="${ROOT_DIR}/.run"
LOGS_DIR="${RUN_DIR}/logs"

PID_BACKEND="${RUN_DIR}/backend.pid"
PID_FRONTEND="${RUN_DIR}/frontend.pid"
MODE_FILE="${RUN_DIR}/mode.txt"

BACKEND_LOG="${LOGS_DIR}/backend.log"
FRONTEND_LOG="${LOGS_DIR}/frontend.log"

DEFAULT_HOST="127.0.0.1"
DEFAULT_PORT="8000"
DEV_FRONTEND_PORT="9000"

# 颜色配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

mkdir -p "${LOGS_DIR}"

# 打印横幅
print_banner() {
  echo -e "${PURPLE}${BOLD}"
  echo "  ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██╗ ██████╗"
  echo " ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║██╔════╝"
  echo " ██║   ██║██████╔╝█████╗  ██╔██╗ ██║█████╗  ██║██║     "
  echo " ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══╝  ██║██║     "
  echo " ╚██████╔╝██║     ███████╗██║ ╚████║██║     ██║╚██████╗"
  echo "  ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝"
  echo -e "       ${CYAN}NovelForge / 仓颉 · AI 交互式小说创作者工坊${NC}\n"
}

# 辅助函数：检测 Python
get_python() {
  if [ -x "${BACKEND_DIR}/.venv/bin/python" ]; then
    echo "${BACKEND_DIR}/.venv/bin/python"
  elif command -v python3 &>/dev/null; then
    echo "$(command -v python3)"
  else
    echo ""
  fi
}

# 辅助函数：检测端口是否被占用
is_port_in_use() {
  local host="$1"
  local port="$2"
  local py
  py="$(get_python)"
  if [ -n "$py" ]; then
    "$py" -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.settimeout(0.5); res = s.connect_ex(('$host', int($port))); s.close(); exit(0 if res == 0 else 1)" &>/dev/null
    return $?
  fi
  return 1
}

# 辅助函数：检测进程是否存活
is_process_running() {
  local pid_file="$1"
  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || echo "")"
    if [ -n "$pid" ] && kill -0 "$pid" &>/dev/null; then
      return 0
    fi
  fi
  return 1
}

# 辅助函数：健康检查探针轮询
wait_for_health() {
  local host="$1"
  local port="$2"
  local max_retries="${3:-30}"
  local count=0
  local url="http://${host}:${port}/api/v1/health"

  while [ "$count" -lt "$max_retries" ]; do
    if curl -s --noproxy "*" -f -m 1 "$url" &>/dev/null; then
      return 0
    fi
    sleep 0.5
    count=$((count + 1))
  done
  return 1
}

# 辅助函数：拉起系统默认浏览器
open_browser() {
  local url="$1"
  # 仅在非 headless 桌面环境下尝试打开
  if [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
    if command -v xdg-open &>/dev/null; then
      nohup xdg-open "$url" &>/dev/null &
    elif command -v python3 &>/dev/null; then
      nohup python3 -m webbrowser "$url" &>/dev/null &
    fi
  fi
}

# 检查前端静态产物是否就绪
ensure_frontend_built() {
  if [ ! -f "${FRONTEND_DIR}/dist/index.html" ]; then
    echo -e "${YELLOW}⚡ 检测到前端构建产物尚未生成，正在自动执行构建打包...${NC}"
    if command -v pnpm &>/dev/null; then
      (cd "${FRONTEND_DIR}" && pnpm run build)
    elif command -v npm &>/dev/null; then
      (cd "${FRONTEND_DIR}" && npm run build)
    else
      echo -e "${RED}❌ 未检测到 pnpm 或 npm，请先安装 Node.js/pnpm 后再执行构建。${NC}"
      exit 1
    fi
    echo -e "${GREEN}✓ 前端产物构建完成！${NC}\n"
  fi
}

# 启动命令：生产单端口集成模式
cmd_start() {
  local host="${1:-$DEFAULT_HOST}"
  local port="${2:-$DEFAULT_PORT}"
  local auto_open="${3:-true}"

  if is_process_running "$PID_BACKEND"; then
    echo -e "${YELLOW}⚠️  OpenFic 服务已经在运行中！${NC}"
    cmd_status
    return 0
  fi

  if is_port_in_use "$host" "$port"; then
    echo -e "${RED}❌ 端口 ${port} 已被其他程序占用，无法启动！${NC}"
    echo -e "请先释放该端口或使用指定端口启动：./start.sh start $host <新端口号>"
    exit 1
  fi

  ensure_frontend_built

  local py
  py="$(get_python)"
  if [ -z "$py" ]; then
    echo -e "${RED}❌ 未找到 Python 环境，请先安装 Python 3.11+ 并配置 backend/.venv${NC}"
    exit 1
  fi

  print_banner
  echo -e "${BLUE}▶ 正在启动 OpenFic 全栈服务 (生产集成模式)...${NC}"
  echo -e "${DIM}  工作目录: ${ROOT_DIR}${NC}"
  echo -e "${DIM}  Python:   ${py}${NC}"
  echo -e "${DIM}  绑定地址: http://${host}:${port}${NC}\n"

  # 后台启动
  nohup setsid "$py" -m app.cli serve --host "$host" --port "$port" </dev/null > "${BACKEND_LOG}" 2>&1 &
  local pid=$!
  disown $pid 2>/dev/null || true
  echo "$pid" > "$PID_BACKEND"
  echo "prod" > "$MODE_FILE"

  echo -ne "${CYAN}⏳ 等待后端服务就绪探针... ${NC}"
  if wait_for_health "$host" "$port" 30; then
    echo -e "${GREEN}${BOLD}成功启动！${NC}\n"
    echo -e "═══════════════════════════════════════════════════════════════"
    echo -e "  🌟 ${BOLD}小说工坊访问地址:${NC}  ${GREEN}${BOLD}http://${host}:${port}${NC}"
    echo -e "  🔌 API 接口文档:${NC}      ${CYAN}http://${host}:${port}/docs${NC}"
    echo -e "  📋 实时运行日志:${NC}      ${DIM}./start.sh logs${NC}"
    echo -e "  🛑 停止后台服务:${NC}      ${DIM}./start.sh stop${NC}"
    echo -e "═══════════════════════════════════════════════════════════════\n"

    if [ "$auto_open" = "true" ]; then
      open_browser "http://${host}:${port}"
    fi
  else
    echo -e "${RED}启动超时或出现异常！${NC}"
    echo -e "请查看日志排查详情: ${BACKEND_LOG}"
    tail -n 25 "${BACKEND_LOG}"
    exit 1
  fi
}

# 启动命令：双端开发热重载模式
cmd_dev() {
  local host="${1:-$DEFAULT_HOST}"
  local port="${2:-$DEFAULT_PORT}"
  local fe_port="${3:-$DEV_FRONTEND_PORT}"
  local auto_open="${4:-true}"

  if is_process_running "$PID_BACKEND" || is_process_running "$PID_FRONTEND"; then
    echo -e "${YELLOW}⚠️  已有服务正在运行中，请先停止: ./start.sh stop${NC}"
    cmd_status
    return 0
  fi

  if is_port_in_use "$host" "$port"; then
    echo -e "${RED}❌ 后端端口 ${port} 已被占用！${NC}"
    exit 1
  fi

  if is_port_in_use "$host" "$fe_port"; then
    echo -e "${RED}❌ 前端开发端口 ${fe_port} 已被占用！${NC}"
    exit 1
  fi

  local py
  py="$(get_python)"
  if [ -z "$py" ]; then
    echo -e "${RED}❌ 未找到 Python 环境！${NC}"
    exit 1
  fi

  print_banner
  echo -e "${BLUE}▶ 正在启动 OpenFic 双端热更新开发环境...${NC}\n"

  # 1. 启动后端服务
  echo -e "${DIM}  [1/2] 正在启动后端 API 服务 (:8000)...${NC}"
  nohup setsid "$py" -m app.cli serve --host "$host" --port "$port" </dev/null > "${BACKEND_LOG}" 2>&1 &
  local pid_be=$!
  disown $pid_be 2>/dev/null || true
  echo $pid_be > "$PID_BACKEND"

  # 等待后端健康就绪
  if ! wait_for_health "$host" "$port" 30; then
    echo -e "${RED}❌ 后端启动失败！请检查日志: ${BACKEND_LOG}${NC}"
    cmd_stop
    exit 1
  fi
  echo -e "${GREEN}  ✓ 后端 API 服务已就绪！${NC}"

  # 2. 启动前端 Vite 开发服务器
  echo -e "${DIM}  [2/2] 正在启动前端 Vite 热更新开发服务器 (:9000)...${NC}"
  local pid_fe=""
  if command -v pnpm &>/dev/null; then
    nohup setsid pnpm --dir "${FRONTEND_DIR}" run dev </dev/null > "${FRONTEND_LOG}" 2>&1 &
    pid_fe=$!
  elif command -v npm &>/dev/null; then
    nohup setsid npm --prefix "${FRONTEND_DIR}" run dev </dev/null > "${FRONTEND_LOG}" 2>&1 &
    pid_fe=$!
  else
    echo -e "${RED}❌ 未检测到 pnpm 或 npm，无法启动前端开发服务器！${NC}"
    cmd_stop
    exit 1
  fi
  disown $pid_fe 2>/dev/null || true
  echo "$pid_fe" > "$PID_FRONTEND"
  echo "dev" > "$MODE_FILE"

  # 等待前端端口就绪
  local count=0
  while [ "$count" -lt 20 ]; do
    if is_port_in_use "$host" "$fe_port"; then
      break
    fi
    sleep 0.5
    count=$((count + 1))
  done

  echo -e "${GREEN}  ✓ 前端 Vite 服务器已就绪！${NC}\n"

  echo -e "═══════════════════════════════════════════════════════════════"
  echo -e "  🌟 ${BOLD}前端热重载工作台:${NC}  ${GREEN}${BOLD}http://${host}:${fe_port}${NC}"
  echo -e "  🔌 后端 API 接口地址:${NC}  ${CYAN}http://${host}:${port}${NC}"
  echo -e "  📋 查看实时前端日志:${NC}  ${DIM}tail -f ${FRONTEND_LOG}${NC}"
  echo -e "  🛑 停止全部后台服务:${NC}  ${DIM}./start.sh stop${NC}"
  echo -e "═══════════════════════════════════════════════════════════════\n"

  if [ "$auto_open" = "true" ]; then
    open_browser "http://${host}:${fe_port}"
  fi
}

# 停止命令
cmd_stop() {
  echo -e "${BLUE}▶ 正在停止 OpenFic 后台服务...${NC}"
  local stopped=0

  # 停止前端
  if [ -f "$PID_FRONTEND" ]; then
    local fe_pid
    fe_pid="$(cat "$PID_FRONTEND" 2>/dev/null || echo "")"
    if [ -n "$fe_pid" ] && kill -0 "$fe_pid" &>/dev/null; then
      kill -TERM -"$fe_pid" 2>/dev/null || kill -TERM "$fe_pid" 2>/dev/null || true
      sleep 0.5
      kill -9 -"$fe_pid" 2>/dev/null || kill -9 "$fe_pid" 2>/dev/null || true
      echo -e "${GREEN}  ✓ 已停止前端开发进程 (PID: ${fe_pid})${NC}"
      stopped=1
    fi
    rm -f "$PID_FRONTEND"
  fi

  # 停止后端
  if [ -f "$PID_BACKEND" ]; then
    local be_pid
    be_pid="$(cat "$PID_BACKEND" 2>/dev/null || echo "")"
    if [ -n "$be_pid" ] && kill -0 "$be_pid" &>/dev/null; then
      kill -TERM -"$be_pid" 2>/dev/null || kill -TERM "$be_pid" 2>/dev/null || true
      sleep 1
      kill -9 -"$be_pid" 2>/dev/null || kill -9 "$be_pid" 2>/dev/null || true
      echo -e "${GREEN}  ✓ 已停止后端服务进程 (PID: ${be_pid})${NC}"
      stopped=1
    fi
    rm -f "$PID_BACKEND"
  fi

  rm -f "$MODE_FILE"

  if [ "$stopped" -eq 1 ]; then
    echo -e "${GREEN}✓ 所有 OpenFic 后台服务已完全停止。${NC}"
  else
    echo -e "${DIM}没有检测到正在运行的 OpenFic 进程。${NC}"
  fi
}

# 状态检测命令
cmd_status() {
  echo -e "═══════════════════════════════════════════════════════════════"
  echo -e "             ${BOLD}OpenFic 服务运行状态监控${NC}"
  echo -e "═══════════════════════════════════════════════════════════════"

  local mode="未运行"
  if [ -f "$MODE_FILE" ]; then
    mode="$(cat "$MODE_FILE")"
  fi

  echo -e "  启动模式:   ${BOLD}${mode}${NC}"

  # 后端检测
  if is_process_running "$PID_BACKEND"; then
    local be_pid
    be_pid="$(cat "$PID_BACKEND")"
    local be_health="${RED}探针无响应${NC}"
    if curl -s --noproxy "*" -f -m 1 "http://127.0.0.1:8000/api/v1/health" &>/dev/null; then
      be_health="${GREEN}正常 (200 OK)${NC}"
    fi
    echo -e "  后端服务:   ${GREEN}🟢 运行中${NC} (PID: ${be_pid}) | 端口: 8000 | 状态: ${be_health}"
  else
    echo -e "  后端服务:   ${DIM}⚪ 已停止${NC}"
  fi

  # 前端检测
  if is_process_running "$PID_FRONTEND"; then
    local fe_pid
    fe_pid="$(cat "$PID_FRONTEND")"
    echo -e "  前端服务:   ${GREEN}🟢 运行中${NC} (PID: ${fe_pid}) | 端口: 9000 (Vite Dev)"
  else
    if [ "$mode" = "prod" ]; then
      echo -e "  前端服务:   ${GREEN}🟢 集成托管${NC} (由后端 8000 端口直接统一提供)"
    else
      echo -e "  前端服务:   ${DIM}⚪ 未运行开发服务器${NC}"
    fi
  fi

  echo -e "───────────────────────────────────────────────────────────────"
  if is_process_running "$PID_BACKEND"; then
    if [ "$mode" = "dev" ]; then
      echo -e "  ➜ 浏览器访问:  ${GREEN}${BOLD}http://127.0.0.1:9000${NC} (开发台)"
    else
      echo -e "  ➜ 浏览器访问:  ${GREEN}${BOLD}http://127.0.0.1:8000${NC} (生产工坊)"
    fi
  else
    echo -e "  ➜ 提示: 输入 ${CYAN}./start.sh start${NC} 可立即启动站点"
  fi
  echo -e "═══════════════════════════════════════════════════════════════\n"
}

# 重启命令
cmd_restart() {
  local mode="prod"
  if [ -f "$MODE_FILE" ]; then
    mode="$(cat "$MODE_FILE")"
  fi
  cmd_stop
  sleep 1
  if [ "$mode" = "dev" ]; then
    cmd_dev "$DEFAULT_HOST" "$DEFAULT_PORT" "$DEV_FRONTEND_PORT" "false"
  else
    cmd_start "$DEFAULT_HOST" "$DEFAULT_PORT" "false"
  fi
}

# 日志查看命令
cmd_logs() {
  local target="${1:-all}"
  if [ "$target" = "frontend" ] || [ "$target" = "fe" ]; then
    echo -e "${CYAN}正在追踪前端日志: ${FRONTEND_LOG}${NC}"
    tail -f "${FRONTEND_LOG}"
  elif [ "$target" = "backend" ] || [ "$target" = "be" ]; then
    echo -e "${CYAN}正在追踪后端日志: ${BACKEND_LOG}${NC}"
    tail -f "${BACKEND_LOG}"
  else
    echo -e "${CYAN}正在追踪全栈运行日志 (Ctrl+C 退出)...${NC}"
    tail -f "${BACKEND_LOG}" "${FRONTEND_LOG}" 2>/dev/null || tail -f "${BACKEND_LOG}"
  fi
}

# 构建前端产物
cmd_build() {
  echo -e "${BLUE}▶ 正在构建前端生产静态资源...${NC}"
  if command -v pnpm &>/dev/null; then
    (cd "${FRONTEND_DIR}" && pnpm run build)
  elif command -v npm &>/dev/null; then
    (cd "${FRONTEND_DIR}" && npm run build)
  else
    echo -e "${RED}❌ 未检测到 pnpm 或 npm${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ 前端产物已更新至 frontend/dist！${NC}"
}

# 打印帮助信息
cmd_help() {
  print_banner
  echo -e "${BOLD}使用说明:${NC}"
  echo -e "  ./start.sh [命令] [参数...]\n"
  echo -e "${BOLD}核心命令:${NC}"
  echo -e "  ${GREEN}start${NC} [host] [port]       以生产集成模式启动（默认: 127.0.0.1:8000，推荐日常使用）"
  echo -e "  ${GREEN}dev${NC}   [host] [port] [fe]   以双端热更新模式启动（后端: 8000，前端 Vite: 9000）"
  echo -e "  ${GREEN}stop${NC}                      安全优雅停止所有后台 OpenFic 服务"
  echo -e "  ${GREEN}restart${NC}                   重启当前模式下的 OpenFic 服务"
  echo -e "  ${GREEN}status${NC}                    查看当前服务运行状态、PID 与健康检查"
  echo -e "  ${GREEN}logs${NC}   [all|backend|fe]   查看实时运行日志"
  echo -e "  ${GREEN}build${NC}                     重新编译前端 SPA 静态产物"
  echo -e "  ${GREEN}help${NC}                      显示此帮助信息\n"
  echo -e "${BOLD}极简用法示例:${NC}"
  echo -e "  ${CYAN}./start.sh${NC}                直接启动网站并在浏览器中打开"
  echo -e "  ${CYAN}./start.sh dev${NC}            以开发者热更新模式启动"
  echo -e "  ${CYAN}./start.sh stop${NC}           停止后台网站运行"
  echo -e "  ${CYAN}./start.sh status${NC}         查看网站运行状态"
  echo -e ""
}

# 主入口分发
ACTION="${1:-start}"

case "$ACTION" in
  start|serve|prod)
    shift || true
    cmd_start "$@"
    ;;
  dev)
    shift || true
    cmd_dev "$@"
    ;;
  stop|down|kill)
    cmd_stop
    ;;
  restart|reload)
    cmd_restart
    ;;
  status|ps)
    cmd_status
    ;;
  logs|log)
    shift || true
    cmd_logs "$@"
    ;;
  build)
    cmd_build
    ;;
  help|--help|-h)
    cmd_help
    ;;
  *)
    echo -e "${RED}未知命令: $ACTION${NC}\n"
    cmd_help
    exit 1
    ;;
esac
