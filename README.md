# 期刊稿件状态自动监控器

这是一个基于 Python 和 GitHub Actions 的自动化程序，旨在帮助科研人员自动监控在 **IEEE (ScholarOne)** 和 **Elsevier (Editorial Manager)** 投稿系统中的稿件状态，并在状态发生变化时通过邮件及时通知。

## ✨ 功能特性

- **双平台支持**: 同时监控 IEEE 和 Elsevier 两大主流出版商的投稿系统。
- **自动化运行**: 无需个人电脑或服务器，利用 **GitHub Actions** 每日定时执行（默认每天3次）。
- **状态变化通知**: 仅在稿件状态发生 **变化** 时发送邮件通知，避免不必要的打扰。
- **安全可靠**: 所有敏感信息（如账户密码、邮箱授权码）均通过 **GitHub Secrets** 安全存储，代码中不包含任何明文密码。
- **易于部署**: 只需 Fork 本仓库，简单配置几个参数，即可一键启动。
- **详细邮件报告**: 邮件内容包含清晰的状态变化对比、稿件标题、ID 和查询链接，一目了然。

## 🚀 快速开始

### 1. Fork 本仓库

点击本页面右上角的 **Fork** 按钮，将此项目复制到您自己的 GitHub 账户下。

### 2. 配置 Secrets

进入您 Fork 后的仓库，依次点击 `Settings` > `Secrets and variables` > `Actions`。然后点击 `New repository secret` 按钮，添加以下 **必须** 的信息：

| Secret 名称         | 说明                                               | 示例值                               |
| ------------------- | -------------------------------------------------- | ------------------------------------ |
| `IEEE_EMAIL`        | 您的 IEEE (ScholarOne) 登录邮箱                    | `your_name@example.com`              |
| `IEEE_PASSWORD`     | 您的 IEEE (ScholarOne) 登录密码                    | `your_ieee_password`                 |
| `ELSEVIER_EMAIL`    | 您的 Elsevier (Editorial Manager) 登录邮箱         | `your_name@example.com`              |
| `ELSEVIER_PASSWORD` | 您的 Elsevier (Editorial Manager) 登录密码         | `your_elsevier_password`             |
| `EMAIL_SENDER`      | 用于发送通知的邮箱地址                             | `your_sender@qq.com`                 |
| `EMAIL_PASSWORD`    | 发件邮箱的 **SMTP授权码** (注意：不是登录密码)     | `abcdefg123456789`                   |
| `EMAIL_RECEIVER`    | 用于接收通知的邮箱地址                             | `your_receiver@example.com`          |

> **注意**:
> - 如果您只监控一个平台（如仅 IEEE），另一个平台的账户信息可以留空，但至少需要配置一个。
> - 如何获取邮箱的SMTP授权码，请参考您邮箱服务商的帮助文档（例如：[QQ邮箱](https://service.mail.qq.com/cgi-bin/help?id=28), [163邮箱](http://help.163.com/09/1223/14/5R7P3QI100753VB8.html)）。

### 3. 启用 Actions

进入您 Fork 后的仓库，点击 `Actions` 标签页。如果看到一个黄色的提示条，请点击 **`I understand my workflows, go ahead and enable them`** 按钮来启用 GitHub Actions。

### 4. 手动触发一次以测试

1.  在 `Actions` 页面，点击左侧的 **`期刊状态监控`** 工作流。
2.  点击右侧的 **`Run workflow`** 下拉菜单。
3.  您可以选择 `normal` (正常监控) 或 `test` (仅发送测试邮件) 模式。
4.  点击 **`Run workflow`** 按钮。

等待几分钟，工作流执行完毕后，检查您的收件邮箱是否收到了通知邮件或测试邮件。首次运行会抓取您所有稿件的当前状态并保存，不会发送通知邮件。

## ⚙️ 工作流配置

### 定时任务

默认情况下，工作流会在每天的 **UTC 时间 1:00, 9:00, 17:00** 自动运行，对应 **北京时间 9:00, 17:00, (次日)1:00**。您可以根据需要修改 `.github/workflows/monitor.yml` 文件中的 `cron` 表达式来调整运行频率。

```yaml
schedule:
  - cron: '0 1,9,17 * * *' # 对应北京时间 9:00, 17:00, 1:00
```

### 运行模式

- **`normal`**: 正常执行监控任务，获取稿件状态，对比变化，并在有变化时发送邮件。
- **`test`**: 不执行监控任务，仅向您的收件邮箱发送一封测试邮件，用于验证邮件配置是否正确。

## 📁 项目结构

```
journal-status-monitor/
├── .github/workflows/
│   └── monitor.yml       # GitHub Actions 核心工作流
├── monitor.py            # 主程序入口，负责抓取和处理
├── config.py             # 配置管理模块
├── notification.py       # 邮件通知模块
├── storage.py            # 数据存储和状态对比模块
├── requirements.txt      # Python 依赖库
├── README.md             # 本说明文档
├── DEPLOYMENT_GUIDE.md   # 详细部署指南
└── .env.example          # 环境变量示例文件
```

## 📚 详细文档

完整的部署指南请查看 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)，其中包含：
- 前置准备和账户配置
- 如何获取邮箱 SMTP 授权码
- 逐步部署流程
- 定时任务配置
- 高级配置选项
- 常见问题解答

## ⚠️ 免责声明

- 本项目仅为学习和研究目的创建，旨在提供便利。请确保您的使用行为符合相关平台（IEEE, Elsevier）的用户协议。
- 本项目通过模拟用户登录来获取信息，如果相关网站的页面结构发生变化，可能会导致程序运行失败。作者会尽力维护，但无法保证其永久可用性。
- 请妥善保管您的账户信息，并使用 **GitHub Secrets** 进行安全存储。对于因使用本项目导致的任何直接或间接损失，作者不承担任何责任。

## 📝 许可证

本项目采用 MIT 许可证。详见 LICENSE 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

---

**祝您使用愉快！希望这个工具能帮助您更高效地跟踪论文审稿进度。** 🎓📝
