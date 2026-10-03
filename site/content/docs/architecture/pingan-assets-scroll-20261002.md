---
title: 资产管理滚动修复
description: 固定高度应用框架内资产页面的滚动边界及实际验证。
---

# 资产管理滚动修复

## 原因与当前实现

应用框架固定为视口高度，内容外层使用 `overflow: hidden`，供工作室等页面自行管理内部滚动。此前 AssetManager 内容按自然高度展开，却没有自己的滚动区域，超过视口的卡片和分页被外层裁切，滚轮无法查看底部。

`front/src/pages/aiStudio/assets/AssetManager.tsx` 现在使用共用的 `pa-assets min-h-0 flex-1 overflow-y-auto` 容器：占满剩余可视高度、允许缩小、超出部分纵向滚动。演员、场景、道具、服装四个标签共用该容器。容器提供“资产管理内容”区域名称及键盘焦点。顶部应用导航和页头不随资产列表滚动，工作室等其他页面的滚动策略不变。

## 实际验证

- 前端测试：22 passed / 0 failed，包含共用滚动容器回归检查。
- 类型检查和生产构建：PASS。既有包体积及 Browserslist 警告保留。
- 本地镜像只更新 frontend，使用本机已通过检查的构建产物、现有 Nginx 和环境注入脚本；未覆盖 `.env`、未操作数据卷或其他服务。
- 浏览器真实演员列表：可视高度 656px、内容高度 1078px，`overflow-y: auto`；滚轮向下到 `scrollTop = 422`，等于最大滚动距离，底部分页位于视口内。
- 场景列表滚轮到 `scrollTop = 302`，等于最大滚动距离；道具、服装标签实际切换成功并保持共用 `overflow-y: auto`。
- 截图：`deploy/local/pingan-assets-scroll-fixed.png`，展示演员列表底部及分页。

本轮修改 AssetManager 和 `front/tests/pingan-ui.test.mjs`，新增本文及验收截图；不改 API、资产内容、数据库、生成能力或业务状态。未调用真实模型。修复范围仅为资产页面滚动，不表示全部产品功能验收通过。

验收入口：<http://localhost:7788/assets?tab=actor&ui_check=20261002>。旧标签若仍缓存旧代码，可强制刷新后在内容区使用滚轮或触控板查看底部。
