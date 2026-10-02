---
title: 2026-10-02 本机部署验收记录
description: Jellyfish 原版界面与独立可修改源码的真实验证结果及未验收边界。
---

# Jellyfish 本机验收记录

检查日期：2026-10-02，Asia/Shanghai。09:50:18 的交付检查确认原平安剧场 UI 为 HTTP 200，API 的 PostgreSQL / Redis 均 healthy。本次没有修改平安剧场项目、数据库、PRD 或模型配置。

## 交付物与基线

- 完整官方仓库与 Git 历史：`https://github.com/Forget-C/Jellyfish`。
- 上游基线：`a9678194ddf2d9be3ccbe78d4287d87d5089e123`。
- 独立开发分支：`codex/jellyfish-local`，保留上游 origin / main。
- 原版 UI：项目大厅、工作台、资产、提示词模板、模型管理、章节、镜头准备、生成工作室、任务中心、媒体与剪辑等原有源码均在，不以原型替代。
- 入口：<http://localhost:7788>；API：<http://127.0.0.1:8010/docs>。
- 独立 MySQL 9、Redis 7、RustFS、Celery 与前后端容器。
- 实际本机工作室截图：`deploy/local/acceptance-ui.png`；截图中的镜头是手工验收数据，不是 AI 生成结果。

## 新建及修改

新增：

- `.dockerignore`：隔离密钥、宿主依赖和缓存，避免进入 Docker 构建上下文。
- `deploy/local/compose.override.yml`：独立端口、回环绑定、worker 并发、初始化保护和存储域名映射。
- `deploy/local/jellyfish.sh`：启动、停止、状态，停止不删除数据。
- `deploy/local/docker-public/config.json`：公开镜像匿名下载，不修改用户 Docker 凭据。
- `deploy/local/init_local_storage.py`：初始化桶和本机素材读取策略，不覆盖已有 policy。
- `deploy/local/test_local_deployment.py`：真实本机管理流程测试。
- `backend/tests/test_local_transaction_boundary.py`：事务提交与响应顺序回归。
- 本机部署说明、扩展边界说明及本验收记录。
- 被 Git 忽略的 `deploy/compose/.env`：本项目独立随机基础设施凭据，真实模型 Key 为空。

修改：

- `backend/app/dependencies.py` 与使用 `get_db` 的 13 个 API 路由文件：仅明确 `scope="function"`，在成功响应发送前完成 commit；业务拒绝/提交失败仍 rollback。不改变领域字段、路径或状态语义。
- `front/package.json`：OpenAPI 下载工具支持 `OPENAPI_URL`，默认仍是上游 8000。

未修改：前端页面、布局、组件、样式、领域数据库模型、模型适配器、生成提示词和原始 LICENSE。OpenAPI 及 generated client 已重新生成并确认与上游无差异。

## 实际验证

| 项目 | 结果 |
| --- | --- |
| 官方锁文件依赖安装 | PASS：pnpm 9.15.9 / uv frozen |
| 原版前端 TypeScript + Vite build | PASS，包含上游 bundle 体积及 Browserslist 警告 |
| Docker 镜像构建 / 启动 | PASS |
| MySQL 初始化与 SQL 导入 | PASS，初始化任务 Exit 0 |
| Redis | PASS：PONG |
| Celery worker | PASS：inspect ping，1 node online |
| RustFS 初始化 | PASS；重复启动保留既有 policy |
| 真实管理流程 | 11 passed：健康、UI、项目/章节/镜头持久化、5 类资产、提示词/模型/任务读取、素材上传/下载/直接访问、准备度查询、无效输入拒绝 |
| 新增事务回归 | 4 passed：commit 在 200 前、commit 失败不返回成功、业务拒绝 rollback、全路由依赖 scope |
| OpenAPI 更新 | PASS；快照与 generated client 无上游差异 |
| 浏览器项目 / 章节创建 | PASS，真实保存并回显 |
| 浏览器资产 / 模板 / 模型管理 | PASS：现有数据、默认模板和未配置供应商状态正确加载 |
| 浏览器镜头编辑 / 工作室 | PASS：真实 pending 镜头可加载；未自动 ready、未执行生成 |
| 原平安剧场 | 保持可访问，未修改 |

管理流程测试保留新建记录，没有删除用户数据。测试针对本机 8010，不复用其他项目数据库或密钥。

### 上游完整测试不是全绿

未经修改的上游完整免费测试首先有 1 个 collection error：`test_video_capabilities.py` 导入不存在的 `infer_ratio_from_size`。

显式排除该文件后：

- 修补前：265 passed / 13 failed。
- 修补后：269 passed / 13 failed（新增 4 项事务回归通过）。

13 个旧失败未新增或隐藏：12 个为测试预期未包含实际响应的 `meta: null`；1 个为删除对白测试的 Fake DB 缺少 `execute`。没有删掉旧测试或修改断言冒充全部通过。因此**不能宣布全量测试通过或成熟生产验收完成**。

## 已修补的部署 / 可靠性问题

1. Docker macOS 凭据助手卡住：独立匿名公开镜像配置，不改用户登录信息。
2. 原 S3 virtual-host 请求无法到达桶：RustFS domain + Docker alias 与原版客户端协议一致。
3. 缩略图 URL 指向内部容器名：本机公开媒体基址改为 127.0.0.1:9002。
4. RustFS 默认素材直接访问 403：创建仅 GetObject 的本机初始化 policy；不开放列目录、写入或管理。
5. 原 SQL 重复启动可能重置自定义模板：仅空表首次导入。
6. 成功响应先于数据库 commit：function scope，真实即时读取和失败回滚测试通过。

## 当前仍需说明的边界

- 真实剧情提取、图像生成、视频生成、生成任务失败/取消、视频剪辑导出等付费/媒体完整链路**未验收**。没有导入现有项目任何 API Key，没有真实模型调用，也没有生成费用。
- 模型管理当前供应商数量为 0。用户需在原版模型管理中配置自己的供应商与默认模型，再另行确认真实验收范围和费用；不要在聊天中发送 Key。
- “完整”指官方源码与功能实现完整保留并可本机启动，不表示每家模型、每个生产工作流已验证成功。
- 上游仪表盘“创建第一章”快捷按钮在已有 dashboard 查询参数下只追加 create=1；实测需要再点击“章节”标签才能弹出创建表单。章节管理内创建已通过。保留原版 UI，没有暗改此行为。
- 上游资产名称存在全局唯一约束，重复名称创建可触发 HTTP 500，而不是友好的业务错误。验收资料改用独立名称，记录该上游行为，不将重复重试计为正常成功。
- 本机媒体读取并非私有素材权限体系；所有端口只绑定回环。不得直接暴露公网，也未进行生产安全、备份恢复、并发/负载及升级兼容性验收。
- 没有将平安剧场专业导演、人工质量门、ShotVersion、事件、Badcase 或组织隔离移植到 Jellyfish。平安剧场 F04 仍按其自己的 BLOCKED 结论，不受本部署结果改变。

## 启动与维护

遵循 `guide/local-deployment.md`。本地停止保留数据库和素材；后续功能在独立分支提交，保持与上游基线可比较。原 LICENSE 已保留；没有向远端推送、创建 PR 或合并另一项目代码。
