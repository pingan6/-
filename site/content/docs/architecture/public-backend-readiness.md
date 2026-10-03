---
title: 公网后台就绪边界
description: 前端发布、接口地址与真实业务可用性分离。
---

# 公网后台就绪边界

2026-10-03 的前端站点是 `https://pingan-tech.vercel.app/projects`。它是独立 Vite 静态部署，不包含数据库、队列、worker 或媒体存储。

## 地址与失败行为

后台地址由 `services/backendConfiguration.ts` 统一解析：运行时 `window.__ENV.BACKEND_URL` 优先于构建时 `VITE_BACKEND_URL`。默认 `public/env.js` 不再写入 localhost，以免覆盖真实构建配置。只有本机 hostname 可默认使用 `http://localhost:8000`；公网缺少地址会显示“尚未配置”，公网 loopback 或 HTTPS 页面上的 HTTP 后台会显示配置错误。显式空字符串表示有意使用同源 API，但并不证明同源 API 已部署。

OpenAPI、旧 Axios 客户端和媒体相对路径不再各自回退到访问者 localhost。项目列表失败显示错误与重试，不再伪装成空列表；配置缺失时创建入口明确阻止请求，失败不关闭表单、不清空输入，不伪造持久化成功。

## 安全边界与剩余阻塞

现有 backend 的项目 CRUD 仅依赖数据库会话，尚未具备应用级用户鉴权和企业数据隔离。Vercel 登录保护仍保留，不向前端放入绕过保护密钥，也不公开现有 backend 来规避保护。

公网真实创建验收仍需：可持久化数据库、后台部署与迁移、应用鉴权/隔离、合法 CORS/HTTPS 地址；完整生成还需 Redis/Celery worker 和媒体存储。不能用 Vercel 临时 SQLite 文件或浏览器假数据替代持久化数据库。尚未完成这些条件前，不宣布公网产品功能可用。未触发任何真实模型或收费生成。
