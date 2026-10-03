---
title: 平安剧场品牌与两页样板验收
description: 2026-10-02 本地视觉改造的真实检查结果与当前边界。
---

# 平安剧场品牌与两页样板验收

## 交付内容

平台名称已改为“平安剧场”，包含页面标题、导航标识、favicon、中英文品牌资源。基于公开 Reading Library 预览适配项目列表和分镜工作室的视觉样板：暖灰纸色、深色中文导航、项目封面卡片、预览与编辑层次。继续使用现有 React/Vite/Ant Design 和原版服务接口，不迁移框架或新增业务模块。

新建文件：

- `front/public/pingan-mark.svg`
- `front/src/theme/pingan.ts`
- `front/src/styles/pingan-workspace.css`
- `front/tests/pingan-ui.test.mjs`
- `site/content/docs/architecture/pingan-ui-sample.md`
- 本验收记录
- `deploy/local/pingan-projects-ui.png`、`deploy/local/pingan-studio-ui.png`

修改文件：

- `front/index.html`、`front/package.json`、`front/src/App.css`
- `front/src/layouts/MainLayout.tsx`
- `front/src/locales/zh-CN/layout.json`、`front/src/locales/en-US/layout.json`
- `front/src/pages/aiStudio/project/ProjectLobby.tsx`
- `front/src/pages/aiStudio/chapter/ChapterStudio.tsx`
- `site/content/docs/architecture/local-extension-boundary.md`
- `site/content/docs/guide/local-deployment.md`

## 检查结果

本地最终复检时间为 2026-10-02 10:52:11（Asia/Shanghai，02:52:11 UTC）。

| 检查 | 实际结果 |
| --- | --- |
| TypeScript `npm run typecheck` | PASS，退出码 0 |
| 界面规则 `npm run test:ui` | 6 passed，0 failed |
| 现有事务边界测试 | 4 passed，0 failed；未修改后端 |
| 生产构建 / 前端容器构建 | PASS；锁文件安装成功 |
| 后端健康检查 | `/api/v1/health` 实际返回 HTTP 200 |
| 品牌与页签 | 页面标题与导航实际显示“平安剧场” |
| 项目首页 | 正常读取 5 个现有项目，页面无整页横向溢出 |
| 搜索 | 不存在名称显示无匹配；清空后恢复真实列表 |
| 阶段筛选 | 可筛选并切回全部；未匹配阶段文案不再误称没有项目 |
| 视图切换 | 紧凑视图可切换，原有卡片操作保持 |
| 新建表单 | 可打开、缺少名称阻止提交、取消正常；未新增真实项目 |
| 键盘操作 | 项目卡片 Enter 成功跳转原项目仪表盘 |
| 非样板页隔离 | 原项目仪表盘仍保留白色原版布局，品牌已更名 |
| 分镜页刷新 | 实际镜头加载，维持待确认；无自动确认 |
| 横向标签 | 生成参数可切换，原有景别/运镜/时长/比例控件可见 |
| 属性面板 | 手动收起后保持收起，预览实际从约 360px 增至 789px；重新展开正常 |
| 空预览文字 | 实际计算文字颜色为 `rgb(232, 223, 210)`，不再黑底黑字 |

页面检查基于实际本地服务与已有验收记录，不使用截图替换页面，不注入虚假业务数据。

## 必要界面修复

1. 原版自动展开 effect 依赖 `inspectorOpen`，用户点击关闭又被立即打开。现在只响应镜头 ID、确认状态或自动展开偏好的变化，保持原版未就绪条件；不改 Shot 状态。
2. 空预览 Badge 被 Ant Design 动态样式覆盖，已提高作用域选择器优先级。
3. 封面上的草稿标签改为高对比浅底，状态文字不变。
4. 筛选结果为空时，区分“当前阶段无项目”和“整个列表无项目”。

## 未实施及已知问题

- 没有全站换皮：资产、模板、模型、项目内部其他页面仍保留原版内容与布局。
- 没有新增/删除项目、改写用户数据、修改 `.env`、数据库 Schema、API、Prompt 或模型配置。仅重建前端容器，没有重启数据库或删除卷。
- 未运行收费生成，不把本次界面测试等同于导演质量、图片/视频生产链路验收；旧平安剧场 F04 Gate 状态不因此改变。
- 截帧等原版 Mock 操作、镜头准备度提示不一致仍保留；现有项目统计/更新时间显示问题未在本轮展开定位或修复。
- 前端主包约 1.78MB（gzip 约 553KB），构建存在已有大包与 Browserslist 过期警告，未扩展为性能重构。
- 桌面三栏样板已检查；不宣称完成移动端全流程支持。
- 尚未做新建成功落库、编辑/删除及模型生成的全业务回归，本次验收聚焦品牌和两个页面。

## 验收入口与下一步

项目列表：<http://localhost:7788/projects>。

已有分镜样板：<http://localhost:7788/projects/c275466f-c313-4ee7-8f5d-8e3f9009d7a7/chapters/e0f30f7b-f4bb-4901-aa2a-ada10690ebc4/studio>。

现有启动方式保持 `bash deploy/local/jellyfish.sh start`。完整说明见 [独立本机部署](../guide/local-deployment)。

等待用户确认视觉样板，不自动扩展其他页面或开始新的产品功能。
