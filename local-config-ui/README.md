# 本地可视化配置后台

这个目录提供一个只在本机运行的配置网页，用来管理期刊状态监控项目的投稿平台、邮件通知、检查时间和高级选项。

## 启动

在 PowerShell 中运行：

```powershell
cd local-config-ui
.\start.ps1
```

然后打开：

```text
http://127.0.0.1:8976
```

也可以直接运行：

```powershell
npm install
npm start
```

## 安全边界

- 服务只监听 `127.0.0.1`，只允许本机访问。
- GitHub token 和 Cloudflare token 只用于当前保存请求，不写入项目文件。
- 投稿系统密码、SMTP 授权码会写入 GitHub Secrets，不会写入仓库明文文件。
- `cloudflare-scheduler/wrangler.toml` 会被更新，用来保存检查时间。

## GitHub Token 权限

保存配置需要 GitHub token 至少具备：

- Repository access: `Xuecheng377/journal-status-monitor`
- Actions: Read and write
- Secrets: Read and write
- Contents: Read and write 如果后续需要自动推送更多文件

当前本地后台主要通过 GitHub API 更新 Actions Secrets，并可选择触发测试 workflow。

## Cloudflare Token 权限

如果勾选“保存后部署 Cloudflare Worker”，需要填写 Cloudflare API Token。该 token 需要能部署当前 Worker：

```text
journal-status-monitor-scheduler
```

如果不勾选部署，网页只会更新本地 `cloudflare-scheduler/wrangler.toml`，不会让线上调度立即生效。

## 页面功能

- 投稿平台：IEEE ScholarOne、Elsevier Editorial Manager
- 邮件通知：发件邮箱、SMTP 授权码、收件人、SMTP 服务器和端口
- 检查时间：每周报告时间、普通状态检查时间
- 高级设置：终态归档、周报是否包含归档稿件、终态关键词
- 保存部署：写入 GitHub Secrets、可选部署 Cloudflare、可选触发测试邮件 workflow

## 旧配置读取

页面会自动读取本地 `cloudflare-scheduler/wrangler.toml`，并预填当前检查时间。

GitHub Secrets 不能被读回明文，这是 GitHub 的安全限制。填写 GitHub token 后，可以点击“检查已配置 Secret”查看哪些 Secret 已存在。对于已经存在的密码、授权码等敏感项，输入框可以留空；保存时会保持旧 Secret 不变。只有你填写新值时，才会覆盖对应 Secret。

## 测试

```powershell
npm test
```
