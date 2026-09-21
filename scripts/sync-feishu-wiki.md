# 飞书知识库 → `docs/` 同步

飞书知识库 **the call 游戏设计案** 为设计文档唯一真源。本脚本做**全量镜像**：目录与 Wiki 节点树一致，本地多出的文件会在同步后删除（差异写入 changelog）。

## 前置条件

1. 已安装并登录 [`lark-cli`](https://open.feishu.cn)（用户身份）：
   ```bash
   lark-cli auth status --verify
   ```
2. 对目标知识库具备读权限（`wiki:node:retrieve`、文档导出相关 scope）。

## 使用

在仓库根目录：

```bash
npm run sync:feishu-docs
```

或直接：

```bash
node scripts/sync-feishu-wiki.mjs
```

## 配置

编辑 [`sync-feishu-wiki.config.json`](./sync-feishu-wiki.config.json)：

| 字段 | 说明 |
|------|------|
| `spaceId` | 知识空间 ID（`lark-cli wiki +space-list --as user`） |
| `spaceName` | 仅用于 changelog 展示 |
| `targetDir` | 本地同步根目录（默认 `docs`） |
| `changelogFile` | 差异记录路径 |
| `preserveRelPaths` | **不参与**镜像与删除的路径（相对 `targetDir`）。默认含 changelog、`docs/6-开发交接/表现层接缝.md`、`docs/agents/*` |
| `larkAs` | 固定 `user` |

## 路径规则

- 递归遍历 Wiki 子节点；节点标题映射为文件夹/文件名（非法 Windows 字符会替换为 `-`）。
- `docx` 节点导出为 Markdown：叶子在父目录下 `{标题}.md`；仅有子节点的分组页 additionally 导出为 `{分组名}.md`（与飞书侧同名节点一致）。

## 差异记录

每次运行向 [`docs/飞书同步差异记录.md`](../docs/飞书同步差异记录.md) **追加**一节，包含：

- 新增 / 删除 / 内容变更（SHA-256 对比）
- 导出失败项（若有）

该文件在 `preserveRelPaths` 中，**不会被同步逻辑删除**。
