# VoiceMatch 项目管理

.PHONY: help build up down dev dev-down logs dev-logs clean db-reset frontend-dev backend-dev migrate migrate-only check-db

help: ## 显示帮助信息
	@echo "VoiceMatch 项目管理命令"
	@echo ""
	@echo "生产环境:"
	@echo "  build    构建所有Docker镜像"
	@echo "  up       启动生产环境"
	@echo "  down     停止生产环境"
	@echo "  logs     查看生产环境日志"
	@echo ""
	@echo "开发环境:"
	@echo "  dev      启动开发环境"
	@echo "  dev-down 停止开发环境"
	@echo "  dev-logs 查看开发环境日志"
	@echo "  frontend-dev 启动前端开发服务器"
	@echo "  backend-dev  启动后端开发服务器"
	@echo ""
	@echo "数据迁移:"
	@echo "  migrate      启动完整环境并执行数据迁移"
	@echo "  migrate-only 仅执行数据迁移（需要MySQL已运行）"
	@echo ""
	@echo "数据库检查:"
	@echo "  check-db  检查当前数据库配置和类型"
	@echo ""
	@echo "其他:"
	@echo "  clean    清理所有容器和镜像"
	@echo "  db-reset 重置数据库"

build: ## 构建所有Docker镜像
	docker-compose build

up: ## 启动生产环境
	docker-compose up -d

down: ## 停止生产环境
	docker-compose down

logs: ## 查看生产环境日志
	docker-compose logs -f

dev: ## 启动开发环境
	docker-compose -f docker-compose.dev.yml up -d

dev-down: ## 停止开发环境
	docker-compose -f docker-compose.dev.yml down

dev-logs: ## 查看开发环境日志
	docker-compose -f docker-compose.dev.yml logs -f

clean: ## 清理所有容器和镜像
	docker-compose down -v --rmi all
	docker-compose -f docker-compose.dev.yml down -v --rmi all
	docker system prune -f

db-reset: ## 重置数据库
	docker-compose down -v
	docker volume rm voicematch_mysql_data || true
	docker-compose up -d db

frontend-dev: ## 启动前端开发服务器
	cd frontend && npm run dev

backend-dev: ## 启动后端开发服务器
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

migrate: ## 启动完整环境并执行数据迁移
	docker-compose up -d db
	sleep 30
	docker-compose --profile migrate up migrate
	docker-compose up -d

migrate-only: ## 仅执行数据迁移（需要MySQL已运行）
	docker-compose --profile migrate up migrate

check-db: ## 检查当前数据库配置和类型
	cd backend && python check_db.py
