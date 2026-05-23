# CONTEXT.md

## 项目概述

`@azsxdc12356/utils` — 一个开源的 TypeScript 通用工具库，提供 Promise 工具、定时器工具和自定义 React Hooks。

## 技术决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 模块系统 | ESM only | 现代前端项目标准，配置简单 |
| 构建工具 | tsup | 零配置、速度快、社区主流 |
| 测试框架 | Vitest | 原生 ESM 支持、配置简单 |
| 代码规范 | ESLint + @typescript-eslint + Prettier | 社区标准配置 |
| 版本管理 | Changesets | 声明式、轻量、自动生成 changelog |
| 开源协议 | MIT | 宽松、广泛使用 |
| 包管理器 | npm | Node 自带、无需额外安装 |

## 目录结构

```
src/
├── utils/          # 纯工具函数（Promise、定时器等）
├── hooks/          # React Hooks
└── index.ts        # 统一导出
```

## 导出方式

子路径导出，用户按需导入：
- `@azsxdc12356/utils` — 纯工具函数
- `@azsxdc12356/utils/hooks` — React Hooks

## 术语定义

- **工具函数**：纯函数，无 React 依赖，位于 `src/utils/`
- **React Hook**：以 `use` 开头的函数，有 React 依赖，位于 `src/hooks/`，`react` 作为 peer dependency
