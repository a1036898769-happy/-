# Daily Plan Lite

用于 GitHub Pages 的纯前端个人工作看板。这个版本没有后端、没有 AI API Key、没有服务端 PDF 导出，所有数据只保存在当前浏览器本地。

## 功能

- 今日待办、优先级排序、截止时间、拖拽排序
- 完成、编辑、删除、顺延和取消顺延
- 待办笔记、未来待办、本月计划和月目标推进记录
- 今日工作总结、手动周报、历史周报
- 打开网页时自动处理未完成待办顺延、月计划顺延和周五 18:00 后周报补生成
- 本地 JSON 备份导出和导入

## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

## 发布到 GitHub Pages

1. 在 GitHub 创建 public 仓库，建议仓库名为 `daily-plan-lite`。
2. 把本项目推送到 `main` 分支。
3. 在仓库 `Settings > Pages` 中选择 `GitHub Actions`。
4. 等待 Actions 完成后访问：

```text
https://你的GitHub用户名.github.io/daily-plan-lite/
```

## 数据说明

- 数据存储在浏览器 `localStorage`，key 为 `daily-plan-lite:v1`。
- 不同浏览器、不同设备之间不会自动同步。
- 清理浏览器数据可能导致内容丢失，请定期使用页面顶部“导出”按钮备份。
- 不要把真实工作数据提交进 GitHub 仓库。
