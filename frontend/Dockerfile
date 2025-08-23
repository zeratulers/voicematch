# 多阶段构建

# 第一阶段：构建
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package.json和yarn.lock
COPY package*.json ./
COPY yarn.lock* ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 第二阶段：运行
FROM nginx:alpine

# 安装curl用于健康检查
RUN apk add --no-cache curl

# 移除默认nginx配置
RUN rm -rf /usr/share/nginx/html/*

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/nginx.conf

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
