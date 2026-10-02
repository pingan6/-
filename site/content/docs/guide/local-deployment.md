---
title: 独立本机部署
description: 启动官方 Jellyfish 界面、API、任务服务和独立存储。
---

# 独立本机部署

本目录是 Jellyfish 官方仓库的完整 Git 克隆，不是界面原型。上游版本为 `a9678194ddf2d9be3ccbe78d4287d87d5089e123`，本地开发分支为 `codex/jellyfish-local`。原版界面、领域字段和业务流程保留；后端仅做“提交事务后才返回成功”的可靠性修补，前端仅增加 OpenAPI 下载地址的工具配置。本机部署调整单独放在 `deploy/local/`，上游原始版本仍完整可追溯。

## 启动与停止

先启动 Docker Desktop。在仓库根目录执行：

```bash
bash deploy/local/jellyfish.sh start
bash deploy/local/jellyfish.sh status
```

首次启动需要下载镜像和构建应用。界面入口为 <http://localhost:7788>，API 文档为 <http://127.0.0.1:8010/docs>。

停止本项目而不删除数据：

```bash
bash deploy/local/jellyfish.sh stop
```

不要使用 `down -v`，不要删除数据卷。停止脚本不会操作平安剧场或其他项目的服务。

## 本机隔离

| 服务 | 本机地址 |
| --- | --- |
| 官方前端 | 127.0.0.1:7788 |
| FastAPI | 127.0.0.1:8010 |
| MySQL 9 | 127.0.0.1:3307 |
| Redis 7 | 127.0.0.1:6380 |
| RustFS S3 | 127.0.0.1:9002 |
| RustFS 控制台 | 127.0.0.1:9003 |

Compose 项目名为 `jellyfish-local`；数据库和素材分别保存在它自己的 MySQL、RustFS 命名卷。所有公开端口仅绑定本机回环地址，不应直接作为公网生产部署。

`deploy/compose/.env` 已加入 Git 忽略，存放本项目独立的本机数据库及对象存储凭据。不要提交或公开此文件，不要把平安剧场的 `.env` 复制到这里。应用容器的 `OPENAI_API_KEY` 在本地覆盖配置中显式设为空，避免继承宿主机密钥。

本机脚本只下载公开镜像，使用自己的匿名 Docker 配置，不修改系统 Docker 登录信息。worker 并发为 1，避免与其他本机项目争抢资源。

启动会检查并创建素材存储桶。原版程序生成直接访问的缩略图地址，因此本机初始化仅在没有既有 policy 时配置匿名 `GetObject`；不开放匿名列目录、写入或管理权限。端口仅限本机，**这不是私有素材或公网生产存储方案**。后续修改的存储 policy 不会在重启时被覆盖。内部虚拟主机访问按 [RustFS 官方说明](https://docs.rustfs.com/en/integration/virtual) 配置域名和容器网络别名，不修改业务存储代码。

## 模型配置

使用官方模型管理页面自行配置供应商及模型。没有配置模型时，管理页面与普通 CRUD 可使用，但剧情提取、图片、视频等真实生成不能完成。部署验证不发起真实模型调用，不代表生成质量、供应商权限或付费链路已验收。

## 构建及免费测试

前端沿用官方锁文件与 pnpm 版本：

```bash
cd front
npx --yes pnpm@9.15.9 install --frozen-lockfile
npx --yes pnpm@9.15.9 run build
```

后端使用 Python 3.12 与 uv：

```bash
cd backend
uv sync --frozen
OPENAI_API_KEY='' DASHSCOPE_API_KEY='' ARK_API_KEY='' uv run pytest -m 'not integration' -q
```

官方当前版本的免费测试存在已有失败，应查看本次本地验收记录，不能把运行命令等同于全部通过。不要运行真实模型 integration 测试，除非另行确认费用和权限。

本机真实管理流程及事务修补回归：

```bash
# 在仓库根目录运行，使用 backend 已安装的测试依赖。
backend/.venv/bin/python -m pytest deploy/local/test_local_deployment.py -q
cd backend
uv run pytest tests/test_local_transaction_boundary.py -q
```

管理流程测试会新增明确命名的验收项目、资产和素材，不执行删除、模型调用或质量门确认，记录保留供追溯。

API 调整后同步官方客户端：

```bash
cd front
OPENAPI_URL=http://127.0.0.1:8010/openapi.json npx --yes pnpm@9.15.9 run openapi:update
```

默认仍兼容上游的 8000 开发端口。事务修补没有改变 OpenAPI 契约，本次重新生成后的客户端和快照与上游一致。

## 后续修改

在本地分支上逐项提交自己的功能，不直接覆盖上游 main。应用逻辑变更与本机部署文件分别管理。接口修改后按根目录 `AGENTS.md` 同步 OpenAPI 和前端 generated client。保留根目录 `LICENSE` 和上游版权信息。
