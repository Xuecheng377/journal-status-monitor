# 期刊状态监控器 - 部署指南

本文档将指导您完成期刊状态监控器的完整部署流程，包括配置账户信息、设置邮件通知、测试运行等步骤。

## 📋 前置准备

在开始部署之前，请确保您已经准备好以下信息：

### 1. 期刊账户信息

您需要至少配置一个期刊平台的账户（IEEE 或 Elsevier），或者两者都配置。

**IEEE (ScholarOne)**
- 登录邮箱
- 登录密码
- 您投稿的期刊的 ScholarOne 系统网址（例如：`https://mc.manuscriptcentral.com/tnnls-ieee`）

**Elsevier (Editorial Manager)**
- 登录邮箱
- 登录密码
- 您投稿的期刊的 Editorial Manager 系统网址（例如：`https://www.editorialmanager.com/your-journal`）

### 2. 邮件配置信息

**发件邮箱**
- 邮箱地址（建议使用 QQ 邮箱、163 邮箱等国内邮箱）
- SMTP 授权码（**不是登录密码**）

**收件邮箱**
- 接收通知的邮箱地址（可以与发件邮箱相同）

### 3. 如何获取 SMTP 授权码

不同邮箱服务商的授权码获取方式略有不同，以下是常见邮箱的获取方法：

**QQ 邮箱**
1. 登录 QQ 邮箱网页版
2. 点击"设置" → "账户"
3. 找到"POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"
4. 开启"POP3/SMTP服务"或"IMAP/SMTP服务"
5. 点击"生成授权码"，按照提示完成验证
6. 保存生成的授权码（16位字符）

**163 邮箱**
1. 登录 163 邮箱网页版
2. 点击"设置" → "POP3/SMTP/IMAP"
3. 开启"IMAP/SMTP服务"
4. 点击"客户端授权密码"，设置授权密码
5. 保存授权密码

**Gmail**
1. 登录 Google 账户
2. 访问"安全性"设置
3. 开启"两步验证"
4. 在"应用专用密码"中生成新密码
5. 保存生成的密码（16位字符）

---

## 🚀 部署步骤

### 步骤 1：Fork 仓库

1. 访问项目仓库：[https://github.com/Xuecheng377/journal-status-monitor](https://github.com/Xuecheng377/journal-status-monitor)
2. 点击页面右上角的 **Fork** 按钮
3. 等待 Fork 完成，您将拥有一个属于自己的副本

### 步骤 2：配置 GitHub Secrets

1. 进入您 Fork 后的仓库
2. 点击 `Settings`（设置）标签
3. 在左侧菜单中找到 `Secrets and variables` → `Actions`
4. 点击 `New repository secret` 按钮

按照下表添加所有必需的 Secrets：

| Secret 名称         | 说明                                    | 是否必填 |
| ------------------- | --------------------------------------- | -------- |
| `IEEE_EMAIL`        | IEEE (ScholarOne) 登录邮箱                    | 可选*    |
| `IEEE_PASSWORD`     | IEEE (ScholarOne) 登录密码                    | 可选*    |
| `IEEE_URL`          | IEEE期刊的ScholarOne网址                     | 可选*    |
| `ELSEVIER_EMAIL`    | Elsevier (Editorial Manager) 登录邮箱   | 可选*    |
| `ELSEVIER_PASSWORD` | Elsevier (Editorial Manager) 登录密码   | 可选*    |
| `ELSEVIER_URL`      | Elsevier期刊的Editorial Manager网址    | 可选*    |
| `EMAIL_SENDER`      | 发件邮箱地址                            | **必填** |
| `EMAIL_PASSWORD`    | 发件邮箱的 SMTP 授权码                  | **必填** |
| `EMAIL_RECEIVER`    | 收件邮箱地址                            | **必填** |

> **注意**：
> - 标记为“可选*”的项至少需要配置一组（IEEE 或 Elsevier），每组必须包括邮箱、密码和期刊网址
> - **重要**：不同的期刊使用不同的网址，请确保配置您投稿期刊的实际网址：
>   - IEEE TIE: `https://mc.manuscriptcentral.com/tie-ieee`
>   - IEEE TNNLS: `https://mc.manuscriptcentral.com/tnnls-ieee`
>   - IEEE TPAMI: `https://mc.manuscriptcentral.com/tpami-cs`
> - `EMAIL_PASSWORD` 是 SMTP 授权码，不是邮箱登录密码
> - 如果只监控一个平台，另一个平台的配置可以留空

**添加 Secret 的步骤：**
1. 在 `Name` 输入框中输入 Secret 名称（如 `IEEE_EMAIL`）
2. 在 `Secret` 输入框中输入对应的值
3. 点击 `Add secret` 按钮
4. 重复以上步骤，添加所有需要的 Secrets

### 步骤 3：启用 GitHub Actions

1. 在您的仓库中，点击 `Actions` 标签
2. 如果看到黄色提示条，点击 **`I understand my workflows, go ahead and enable them`** 按钮
3. GitHub Actions 现在已启用

### 步骤 4：测试运行

在正式启用定时任务之前，建议先手动运行一次以测试配置是否正确。

1. 在 `Actions` 页面，点击左侧的 **`期刊状态监控`** 工作流
2. 点击右侧的 **`Run workflow`** 下拉菜单
3. 选择运行模式：
   - **`test`**：仅发送测试邮件，不执行监控任务（推荐首次使用）
   - **`normal`**：执行完整的监控任务
4. 点击 **`Run workflow`** 按钮

**查看运行结果：**
1. 等待几分钟，工作流运行完成后，点击运行记录查看详情
2. 点击 `monitor` 任务，查看每个步骤的日志
3. 检查您的收件邮箱，确认是否收到了测试邮件或通知邮件

**常见问题排查：**
- 如果没有收到邮件，检查 `执行监控任务` 步骤的日志，查看是否有错误信息
- 如果提示"配置不完整"，检查 Secrets 是否正确配置
- 如果提示"邮件发送失败"，检查 `EMAIL_PASSWORD` 是否为 SMTP 授权码（而非登录密码）

### 步骤 5：调整定时任务（可选）

默认情况下，工作流会在每天的 **北京时间 9:00、17:00 和次日 1:00** 自动运行。如果您需要调整运行时间，可以修改 `.github/workflows/monitor.yml` 文件中的 `cron` 表达式。

**示例：**

| 北京时间                  | cron 表达式（UTC）      |
| ------------------------- | ----------------------- |
| 每天 9:00                 | `'0 1 * * *'`           |
| 每天 9:00, 17:00          | `'0 1,9 * * *'`         |
| 每天 9:00, 17:00, 次日1:00 | `'0 1,9,17 * * *'`      |
| 每小时                    | `'0 * * * *'`           |

**修改方法：**
1. 在仓库中找到 `.github/workflows/monitor.yml` 文件
2. 点击右上角的铅笔图标（编辑）
3. 找到第 5 行的 `cron` 表达式，修改为您需要的时间
4. 点击 `Commit changes` 保存

---

## ⚙️ 高级配置

### 自定义 SMTP 服务器

如果系统无法自动识别您的邮箱 SMTP 服务器，或者您想使用自定义的 SMTP 配置，可以添加以下 Secrets：

| Secret 名称 | 说明                                      | 示例值          |
| ----------- | ----------------------------------------- | --------------- |
| `SMTP_HOST` | SMTP 服务器地址                           | `smtp.qq.com`   |
| `SMTP_PORT` | SMTP 端口（SSL 使用 465，TLS 使用 587）   | `465`           |

### 调整期刊系统网址

由于不同期刊使用的 ScholarOne 或 Editorial Manager 实例可能不同，您可能需要修改 `monitor.py` 文件中的登录网址。

**修改方法：**
1. 在仓库中找到 `monitor.py` 文件
2. 找到 `fetch_ieee_manuscripts` 方法中的 `login_url` 变量（约第 80 行）
3. 将其修改为您投稿期刊的 ScholarOne 网址
4. 同样，找到 `fetch_elsevier_manuscripts` 方法中的 `login_url` 变量（约第 180 行）
5. 将其修改为您投稿期刊的 Editorial Manager 网址
6. 提交更改

---

## 🔍 监控和维护

### 查看运行历史

1. 在仓库中点击 `Actions` 标签
2. 查看 `期刊状态监控` 工作流的运行历史
3. 点击任意运行记录，查看详细日志

### 查看稿件数据

每次运行后，稿件状态数据会保存在 `data/manuscripts.json` 文件中。您可以在仓库中查看这个文件，了解当前所有稿件的状态。

### 手动触发运行

如果您想立即检查稿件状态，而不等待定时任务，可以：
1. 进入 `Actions` → `期刊状态监控`
2. 点击 `Run workflow`
3. 选择 `normal` 模式
4. 点击 `Run workflow` 按钮

### 暂停监控

如果您想暂时停止监控（例如论文已发表），可以：
1. 进入 `Actions` 标签
2. 点击左侧的 `期刊状态监控` 工作流
3. 点击右上角的 `...` 菜单
4. 选择 `Disable workflow`

需要恢复时，再次点击 `Enable workflow` 即可。

---

## ❓ 常见问题

### Q1: 为什么没有收到邮件通知？

**A:** 可能的原因：
1. 首次运行时，系统会记录当前状态，不会发送通知。只有在后续运行中检测到状态变化时才会发送邮件。
2. 邮件配置有误，检查 `EMAIL_PASSWORD` 是否为 SMTP 授权码（而非登录密码）。
3. 稿件状态确实没有变化。

### Q2: 工作流运行失败怎么办？

**A:** 
1. 查看 Actions 日志，找到具体的错误信息。
2. 常见错误包括：
   - 登录失败：检查账户密码是否正确
   - 页面元素未找到：可能是网站结构发生变化，需要更新 XPath
   - 邮件发送失败：检查邮件配置

### Q3: 如何更新代码？

**A:**
如果原仓库有更新，您可以：
1. 在您的 Fork 仓库页面，点击 `Sync fork` 按钮
2. 点击 `Update branch` 同步最新代码

### Q4: 如何添加更多期刊？

**A:**
如果您在多个期刊投稿，需要修改 `monitor.py` 文件，为每个期刊添加对应的登录逻辑。这需要一定的 Python 编程知识。

---

## 📞 获取帮助

如果您在部署过程中遇到问题，可以：
1. 查看 Actions 运行日志，寻找错误信息
2. 在仓库的 Issues 页面提交问题
3. 参考项目的 README.md 文档

---

**祝您使用愉快！希望这个工具能帮助您更高效地跟踪论文审稿进度。** 🎉
