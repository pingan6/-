---
title: 全站界面统一修复验收
description: 2026-10-02 切页换肤及资产页刷新问题的实际修复和验证。
---

# 全站界面统一修复验收

## 问题与修复

原主题按路由启用：项目列表和工作室应用暖色主题，资产等页面返回上游白蓝主题，展开侧栏也在 200px / 220px 之间变化。

- `front/src/theme/pingan.ts` 移除路由判断，导出唯一 `pinganTheme`。
- `front/src/main.tsx` 在根 ConfigProvider 应用该主题，普通页面和弹窗共同继承。
- `front/src/layouts/MainLayout.tsx` 固定公共 `pa-shell` 和展开导航宽度 200px，保留折叠偏好。
- `front/src/styles/pingan-workspace.css` 统一公共导航、页头、背景和主按钮；删除按钮仍红色，成功/警告/错误状态色不改写。各页业务布局没有被强行合并。
- `front/tests/pingan-ui.test.mjs` 将旧“路由隔离主题”断言改为全站统一断言，并验证危险按钮隔离。
- `deploy/docker/nginx.conf` 移除目录匹配 `$uri/`，避免 SPA `/assets` 被构建产物同名目录重定向到丢失端口的地址。
- `deploy/local/test_local_deployment.py` 增加五个前端路由直接访问/刷新无重定向测试。
- 更新 `pingan-ui-sample.md` 和 `local-extension-boundary.md` 的当前实现边界；历史验收文档不改写。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 前端 `npm run test:ui` | 21 passed / 0 failed |
| 前端 `npm run typecheck` | PASS |
| 前端 `npm run build` | PASS |
| 本地健康和前端刷新测试 | 6 passed / 10 deselected，仅运行只读检查 |
| `git diff --check` | PASS |
| 项目 → 资产 → 模板 → 模型 → 设置 → 资产 | 公共主题一致 |
| 资产新建弹窗 | 创建按钮继承暖棕主题，取消后无新增数据 |
| 资产删除按钮 | 红色 `rgb(255, 77, 79)` 保留，未点击删除 |
| 资产页新标签直接访问及刷新 | PASS，真实资产列表加载，暖色导航保留 |

五个菜单页面实际计算样式一致：导航 `rgb(41, 39, 36)`、展开宽度 `200px`、页头 `rgb(250, 249, 246)`、内容背景 `rgb(243, 241, 236)`、主按钮 `rgb(118, 86, 56)`。资产标签和弹窗主按钮也继承暖棕主题。

验证资产刷新时先发现旧 301 跳转问题，完成 Nginx 修复后五条路由 HTTP 检查均直接返回 200、无 Location。浏览器旧标签仍存在旧跳转缓存；新标签使用 `?tab=actor&ui_check=20261002` 实际访问并刷新通过，未清除用户浏览器数据。若旧标签仍走旧地址，应重新从项目列表进入或强制刷新。

截图：`deploy/local/pingan-assets-unified-ui.png`。

## 部署

只更新 `jellyfish-local-front-1`。共享 Docker 环境中 TypeScript/Vite 编译出现长时间停滞，已取消该次构建。使用本机已通过检查的 `front/dist`、现有 Nginx 配置和现有环境注入脚本构建等价运行镜像，再执行 Compose `up --no-build --no-deps front`，已成功启动。

运行镜像仍为 `jellyfish-local-front:latest`，无新的产品服务或持久化数据。临时构建上下文不包含 `.env`；未覆盖任何环境变量文件，也未停止其他项目服务。

入口：<http://localhost:7788/projects>。资产页面验收入口：<http://localhost:7788/assets?tab=actor&ui_check=20261002>。

## 未实现与已知问题

- 本轮只修复全站公共界面一致性和相关页面刷新，不重做全部页面内部布局。
- 系统设置仍有上游未翻译的 `settings.*` 文案，已记录，未纳入本轮换肤修复。
- Browserslist 数据陈旧及主包体积警告仍存在；全部业务/后端测试没有在本轮重跑，不将局部检查称为全量通过。
- 未修改 API、数据库、领域状态、PRD、Prompt 或模型配置；未新增业务数据，未调用真实模型。
- 旧平安剧场 F04 仍为 BLOCKED，本次主题修复不代表其 Engineering Gate 通过，也不代表产品达到成熟生产标准。

本轮符合用户确认的切页界面修复范围，未开始新 Sprint。下一步由用户验收统一界面，再决定其他问题的处理范围。
