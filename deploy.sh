#!/bin/bash

# VoiceMatch 一键部署脚本
# 适用于VPS服务器部署

set -e

echo "🚀 VoiceMatch 部署脚本启动..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查Docker
check_docker() {
    echo -e "${BLUE}📋 检查Docker环境...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker未安装，请先安装Docker${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose未安装，请先安装Docker Compose${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker环境检查通过${NC}"
}

# 检查环境变量文件
check_env() {
    echo -e "${BLUE}📋 检查环境变量配置...${NC}"
    
    if [ ! -f ".env" ]; then
        if [ -f "env.example" ]; then
            echo -e "${YELLOW}⚠️  未找到.env文件，从env.example复制...${NC}"
            cp env.example .env
            echo -e "${YELLOW}⚠️  请编辑.env文件，修改默认密码和密钥！${NC}"
            echo -e "${YELLOW}⚠️  按任意键继续...${NC}"
            read -n 1
        else
            echo -e "${RED}❌ 未找到环境变量配置文件${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ 环境变量配置检查通过${NC}"
}

# 启动数据库
start_database() {
    echo -e "${BLUE}🗄️  启动MySQL数据库...${NC}"
    
    docker-compose up -d db
    
    echo -e "${YELLOW}⏳ 等待数据库启动...${NC}"
    sleep 30
    
    echo -e "${GREEN}✅ 数据库启动完成${NC}"
}

# 执行数据迁移
run_migration() {
    echo -e "${BLUE}🔄 执行数据迁移...${NC}"
    
    if [ -f "backend/voicematch.db" ]; then
        echo -e "${YELLOW}📊 检测到SQLite数据库，开始迁移到MySQL...${NC}"
        
        # 执行迁移
        docker-compose --profile migrate up migrate
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ 数据迁移完成${NC}"
        else
            echo -e "${RED}❌ 数据迁移失败${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  未检测到SQLite数据库，跳过迁移${NC}"
    fi
}

# 构建和启动服务
build_and_start() {
    echo -e "${BLUE}🔨 构建Docker镜像...${NC}"
    make build
    
    echo -e "${BLUE}🚀 启动所有服务...${NC}"
    make up
    
    echo -e "${GREEN}✅ 服务启动完成${NC}"
}

# 验证部署
verify_deployment() {
    echo -e "${BLUE}🔍 验证部署状态...${NC}"
    
    # 等待服务启动
    sleep 10
    
    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        echo -e "${GREEN}✅ 服务运行正常${NC}"
    else
        echo -e "${RED}❌ 服务启动异常${NC}"
        docker-compose ps
        exit 1
    fi
    
    # 检查健康状态
    if curl -f http://localhost/health &> /dev/null; then
        echo -e "${GREEN}✅ 前端服务健康检查通过${NC}"
    else
        echo -e "${YELLOW}⚠️  前端健康检查失败，可能还在启动中${NC}"
    fi
    
    if curl -f http://localhost:8000/api/health &> /dev/null; then
        echo -e "${GREEN}✅ 后端API健康检查通过${NC}"
    else
        echo -e "${YELLOW}⚠️  后端API健康检查失败，可能还在启动中${NC}"
    fi
}

# 显示部署信息
show_info() {
    echo -e "${GREEN}"
    echo "🎉 VoiceMatch 部署完成！"
    echo ""
    echo "📱 访问地址:"
    echo "   前端: http://localhost"
    echo "   后端API: http://localhost:8000"
    echo "   API文档: http://localhost:8000/docs"
    echo ""
    echo "📊 服务状态:"
    echo "   docker-compose ps"
    echo ""
    echo "📝 查看日志:"
    echo "   make logs"
    echo ""
    echo "🛑 停止服务:"
    echo "   make down"
    echo ""
    echo "🔄 重启服务:"
    echo "   make up"
    echo -e "${NC}"
}

# 主函数
main() {
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}    VoiceMatch 部署脚本${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    
    check_docker
    check_env
    start_database
    run_migration
    build_and_start
    verify_deployment
    show_info
}

# 错误处理
trap 'echo -e "${RED}❌ 部署过程中发生错误${NC}"; exit 1' ERR

# 执行主函数
main "$@"

