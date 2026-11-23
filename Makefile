# 项目交付校验与部署命令入口
# 创建日期：2026-07-29
# 修改日期：2026-11-23

.DEFAULT_GOAL := help
.PHONY: help setup verify verify-all lint lint-all check test author commit push rebase
.PHONY: dev deploy announcements

COMMAND_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))

# ---------------------- 通用 ----------------------
help: ## 显示按分组排列的命令
	@awk 'BEGIN { FS = ":.*?## " } /^# -+ .+ -+$$/ { gsub(/^# -+ | -+$$/, ""); printf "\n%s\n", $$0 } /^[a-zA-Z_-]+:.*?## / { printf "  %-24s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
setup: ## 检查工具并安装 pre-push 钩子
	bash scripts/setup.sh
lint: ## 增量规范校验（禁用字符/文件头/注释语法/注释篇幅/注释黑话/必需文件/命名/模块边界/样式注释/import 排版/测试位置/压测/集合写法/类型注解）
	bash scripts/check.sh --changed
lint-all: ## 全量规范校验
	bash scripts/check.sh --all
test: ## 运行项目测试
	bash scripts/test.sh
check: ## 运行项目测试（兼容旧入口）
	bash scripts/test.sh
verify: ## 增量校验和测试
	bash scripts/check.sh --changed
	bash scripts/test.sh
verify-all: ## 全量校验和测试
	bash scripts/check.sh --all
	bash scripts/test.sh

# ---------------------- Git ----------------------
author: ## 设置 Git 姓名和邮箱
author commit rebase:
	@bash scripts/git-commands.sh $@ $(foreach arg,$(COMMAND_ARGS),'$(arg)')
commit: ## 暂存并提交修改
rebase: ## 将当前分支变基合入 main
push: ## 推送本地 main 到远程 main
	git push origin main:main

# ---------------------- Wiki ----------------------
announcements: ## 抓取狼队公告并更新 Wiki 更新日志页面
	node scripts/fetch-announcements.mjs

# ---------------------- Workers ----------------------
dev: ## 本地启动 Worker（读取 .dev.vars）
	pnpm exec wrangler dev
deploy: ## 部署 Worker 到 Cloudflare
	pnpm exec wrangler deploy

ifneq ($(filter author commit rebase,$(firstword $(MAKECMDGOALS))),)
$(COMMAND_ARGS):
	@:
endif
