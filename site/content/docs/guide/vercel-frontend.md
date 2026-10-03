---
title: Vercel 前端部署
description: 仅发布平安科技界面，不代表完整后台上线。
---

# Vercel 前端部署

从 `pingan6/-` 导入独立项目，Root Directory 选择 `front`，Framework 选择 Vite，构建命令 `pnpm run build`，输出目录 `dist`。使用 Hobby 默认构建配置，不启用付费服务。

`front/vercel.json` 支持 React Router 深层链接和刷新。静态资源由 Vercel 文件系统提供；`/api/` 不回退到前端 HTML，也不代理受保护的后台。

## 验收边界

前端公开需要验证匿名 HTTP 请求和浏览器渲染。前端部署不包含 MySQL、Redis、Celery worker 或媒体存储，也不会迁移本机项目数据。不能将界面可打开当成业务功能可用。

当前 `public/env.js` 默认指向本机后台，且运行时配置优先于 `VITE_BACKEND_URL`。完整公网功能上线前，需要独立配置真实可用的 HTTPS 后台并处理运行时配置、应用鉴权、CORS、数据库、任务队列和媒体存储。不得将 API Key 写入前端配置或通过浏览器代理暴露 Vercel 保护绕过密钥。

保留现有 backend 项目保护。不要为展示前端解除后台保护，不启用 Mock 冒充真实服务，不上传 `.env`。

## 本地检查

在 `front` 目录运行 `npm run test:ui`、`npm run typecheck` 和 `npm run build`。发布后匿名检查根路径、`/projects`、JS/CSS 资源与界面显示；后台未部署时仍需单独报告功能限制。
