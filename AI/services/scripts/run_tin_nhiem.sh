#!/bin/bash
# === Khởi động backend phiếu tín nhiệm ===

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../../../.." && pwd )"
source "$PROJECT_ROOT/.venv/bin/activate" || {
  echo "❌ Không tìm thấy môi trường ảo .venv"
  exit 1
}

cd "$PROJECT_ROOT/AI/app/services" || {
  echo "❌ Không tìm thấy thư mục backend services"
  exit 1
}

echo "🚀 Khởi động backend Tin Nhiệm trên port 8001..."
uvicorn backend_tin_nhiem:app --reload --port 8001