# VoiceMatch 术中语音指令播放系统
# 开发和部署工具

.PHONY: help dev dev-backend dev-frontend build up down clean logs test lint format seed install

# 默认目标
help:
	@echo "VoiceMatch 术中语音指令播放系统 - 开发工具"
	@echo ""
	@echo "可用命令："
	@echo "  help              显示此帮助信息"
	@echo "  install           安装开发依赖"
	@echo "  dev               启动完整开发环境"
	@echo "  dev-backend       仅启动后端开发服务器"
	@echo "  dev-frontend      仅启动前端开发服务器"
	@echo "  build             构建Docker镜像"
	@echo "  up                启动Docker Compose服务"
	@echo "  down              停止Docker Compose服务"
	@echo "  clean             清理Docker资源"
	@echo "  logs              查看服务日志"
	@echo "  test              运行测试"
	@echo "  lint              代码检查"
	@echo "  format            代码格式化"
	@echo "  seed              初始化种子数据"
	@echo "  migration         生成数据库迁移"
	@echo "  migrate           执行数据库迁移"

# 安装开发依赖
install:
	@echo "正在安装后端依赖..."
	cd backend && pip install -r requirements.txt
	@echo "正在安装前端依赖..."
	cd frontend && npm install
	@echo "依赖安装完成！"

# 启动完整开发环境
dev:
	@echo "启动完整开发环境..."
	docker-compose -f docker-compose.dev.yml up -d db minio
	@echo "等待数据库启动..."
	sleep 10
	@echo "启动后端服务..."
	$(MAKE) dev-backend &
	@echo "启动前端服务..."
	$(MAKE) dev-frontend &
	wait

# 启动后端开发服务器
dev-backend:
	@echo "启动后端开发服务器..."
	cd backend && \
	export PYTHONPATH=. && \
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 启动前端开发服务器
dev-frontend:
	@echo "启动前端开发服务器..."
	cd frontend && npm run dev

# 构建Docker镜像
build:
	@echo "构建Docker镜像..."
	docker-compose build --no-cache

# 启动Docker Compose服务
up:
	@echo "启动Docker Compose服务..."
	docker-compose up -d
	@echo "服务已启动！"
	@echo "前端访问地址: http://localhost"
	@echo "后端API地址: http://localhost:8000"
	@echo "API文档地址: http://localhost:8000/api/docs"

# 停止Docker Compose服务
down:
	@echo "停止Docker Compose服务..."
	docker-compose down

# 清理Docker资源
clean:
	@echo "清理Docker资源..."
	docker-compose down -v --remove-orphans
	docker system prune -f
	docker volume prune -f

# 查看服务日志
logs:
	docker-compose logs -f

# 运行测试
test:
	@echo "运行后端测试..."
	cd backend && python -m pytest tests/ -v
	@echo "运行前端测试..."
	cd frontend && npm run test

# 代码检查
lint:
	@echo "后端代码检查..."
	cd backend && ruff check . && mypy .
	@echo "前端代码检查..."
	cd frontend && npm run lint

# 代码格式化
format:
	@echo "格式化后端代码..."
	cd backend && black . && ruff format .
	@echo "格式化前端代码..."
	cd frontend && npm run format

# 生成数据库迁移
migration:
	@echo "生成数据库迁移..."
	cd backend && alembic revision --autogenerate -m "$(MSG)"

# 执行数据库迁移
migrate:
	@echo "执行数据库迁移..."
	cd backend && alembic upgrade head

# 初始化种子数据
seed:
	@echo "初始化种子数据..."
	cd backend && python scripts/seed_data.py

# Docker Compose开发版
dev-docker:
	@echo "启动Docker开发环境..."
	docker-compose -f docker-compose.dev.yml up --build

# 备份数据库
backup:
	@echo "备份数据库..."
	docker exec voicematch_db mysqldump -u root -pvoicematch123 voicematch > backup_$(shell date +%Y%m%d_%H%M%S).sql

# 恢复数据库
restore:
	@if [ -z "$(FILE)" ]; then echo "请指定备份文件: make restore FILE=backup.sql"; exit 1; fi
	@echo "恢复数据库..."
	docker exec -i voicematch_db mysql -u root -pvoicematch123 voicematch < $(FILE)
