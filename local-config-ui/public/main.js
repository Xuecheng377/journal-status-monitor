const $ = (id) => document.getElementById(id);
let existingSecrets = {};
let configuredAccounts = [];
let additionCount = 0;

function intValue(id, fallback) {
  const value = Number.parseInt($(id).value, 10);
  return Number.isInteger(value) ? value : fallback;
}

function hourList(id) {
  return $(id)
    .value.split(/[,\s，]+/)
    .map((item) => Number.parseInt(item, 10))
    .filter((value) => Number.isInteger(value));
}

function platformSlotNames(platform, slot) {
  const prefix = slot === 1 ? platform.toUpperCase() : `${platform.toUpperCase()}_${slot}`;
  return [`${prefix}_EMAIL`, `${prefix}_PASSWORD`, `${prefix}_URL`];
}

function existingPlatformSlots(platform) {
  const slots = [];
  for (let slot = 1; slot <= 5; slot += 1) {
    if (platformSlotNames(platform, slot).every((name) => existingSecrets[name])) {
      slots.push(slot === 1 ? platform.toUpperCase() : `${platform.toUpperCase()}_${slot}`);
    }
  }
  return slots;
}

function collectPlatformAdditions() {
  return Array.from(document.querySelectorAll(".platform-addition")).map((card) => ({
    id: card.dataset.additionId,
    slot: card.dataset.slot ? Number.parseInt(card.dataset.slot, 10) : undefined,
    platform: card.querySelector("[data-field='platform']").value,
    url: card.querySelector("[data-field='url']").value,
    email: card.querySelector("[data-field='email']").value,
    password: card.querySelector("[data-field='password']").value,
  }));
}

function collectSettings() {
  const includeIeeeLegacy = $("enableIeeeOverwrite").checked;
  const includeElsevierLegacy = $("enableElsevierOverwrite").checked;
  return {
    repository: {
      owner: "Xuecheng377",
      name: "journal-status-monitor",
      workflow: "monitor.yml",
      ref: "main",
    },
    platforms: {
      ieee: includeIeeeLegacy ? {
        url: $("ieeeUrl").value,
        email: $("ieeeEmail").value,
        password: $("ieeePassword").value,
      } : null,
      elsevier: includeElsevierLegacy ? {
        url: $("elsevierUrl").value,
        email: $("elsevierEmail").value,
        password: $("elsevierPassword").value,
      } : null,
    },
    platformAccounts: {
      additions: collectPlatformAdditions(),
    },
    email: {
      sender: $("emailSender").value,
      password: $("emailPassword").value,
      receivers: $("emailReceivers").value,
      smtpServer: $("smtpServer").value,
      smtpPort: $("smtpPort").value,
    },
    schedule: {
      weeklyReport: {
        dayOfWeek: intValue("weeklyDay", 1),
        hour: intValue("weeklyHour", 8),
        minute: intValue("weeklyMinute", 17),
      },
      normalChecks: {
        hours: hourList("normalHours"),
        minute: intValue("normalMinute", 17),
      },
    },
    runtime: {
      archiveTerminal: $("archiveTerminal").checked,
      includeArchivedInReport: $("includeArchived").checked,
      terminalStatusKeywords: $("terminalKeywords").value,
    },
  };
}

function collectTokens() {
  return {
    githubToken: $("githubToken").value,
    cloudflareToken: $("cloudflareToken").value,
  };
}

function applyCurrentConfig(data) {
  if (data.repository) {
    // Repository fields are fixed for this project in the current UI.
  }
  if (data.schedule?.weeklyReport) {
    $("weeklyDay").value = String(data.schedule.weeklyReport.dayOfWeek ?? 1);
    $("weeklyHour").value = String(data.schedule.weeklyReport.hour ?? 8);
    $("weeklyMinute").value = String(data.schedule.weeklyReport.minute ?? 17);
  }
  if (data.schedule?.normalChecks) {
    $("normalHours").value = (data.schedule.normalChecks.hours || [11, 12, 14, 17, 20, 22]).join(",");
    $("normalMinute").value = String(data.schedule.normalChecks.minute ?? 17);
  }
  existingSecrets = data.existingSecrets || existingSecrets;
  configuredAccounts = data.accounts || configuredAccounts;
  renderSecretStatus();
  renderAccountList();
}

function renderSecretStatus() {
  const ieeeSlots = existingPlatformSlots("ieee");
  const elsevierSlots = existingPlatformSlots("elsevier");
  const ieeeConfigured = ieeeSlots.length > 0;
  const elsevierConfigured = elsevierSlots.length > 0;
  $("ieeeStatus").textContent = ieeeConfigured ? `已存在：${ieeeSlots.join("、")}；留空保持不变` : "未检测到完整 IEEE 旧配置";
  $("elsevierStatus").textContent = elsevierConfigured ? `已存在：${elsevierSlots.join("、")}；留空保持不变` : "未检测到完整 Elsevier 旧配置";
  $("ieeeStatus").classList.toggle("ok", ieeeConfigured);
  $("elsevierStatus").classList.toggle("ok", elsevierConfigured);
}

function addPlatformCard(initial = {}) {
  additionCount += 1;
  const card = document.createElement("div");
  card.className = "card platform-addition";
  card.dataset.index = String(additionCount);
  card.dataset.additionId = initial.id || `addition-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if (initial.slot) {
    card.dataset.slot = String(initial.slot);
  }
  const title = initial.slot ? `修改 ${String(initial.label || "").trim() || `槽位 ${initial.slot}`}` : `新增投稿账号 ${additionCount}`;
  const hint = initial.slot
    ? "这组会覆盖指定槽位。密码留空时，如果该槽位已配置密码，会保持旧密码不变。"
    : "这组会写入下一个空 Secret 槽位，例如 IEEE_2_EMAIL，不会覆盖 IEEE_EMAIL。";
  card.innerHTML = `
    <div class="card-title-row">
      <h3>${title}</h3>
      <button type="button" class="ghost remove-platform">移除</button>
    </div>
    <label>投稿平台
      <select data-field="platform">
        <option value="ieee">IEEE ScholarOne</option>
        <option value="elsevier">Elsevier Editorial Manager</option>
      </select>
    </label>
    <label>投稿系统网址<input data-field="url" placeholder="https://mc.manuscriptcentral.com/..."></label>
    <label>登录邮箱 / 用户名<input data-field="email" autocomplete="username"></label>
    <label>登录密码<input data-field="password" type="password" autocomplete="new-password" placeholder="${initial.slot ? "留空保持旧密码" : ""}"></label>
    <p class="hint">${hint}</p>
  `;
  card.querySelector("[data-field='platform']").value = initial.platform || "ieee";
  if (initial.slot) {
    card.querySelector("[data-field='platform']").disabled = true;
  }
  card.querySelector("[data-field='url']").value = initial.url || "";
  card.querySelector("[data-field='email']").value = initial.email || "";
  card.querySelector("[data-field='password']").value = initial.password || "";
  card.querySelector(".remove-platform").addEventListener("click", () => card.remove());
  $("platformAdditions").appendChild(card);
  card.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderAccountList() {
  const list = $("accountList");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  if (!configuredAccounts.length) {
    const empty = document.createElement("div");
    empty.className = "message warn";
    empty.textContent = "尚未加载账号列表。填写 GitHub Token 后点击“刷新账号列表”。";
    list.appendChild(empty);
    return;
  }

  for (const account of configuredAccounts) {
    const row = document.createElement("div");
    row.className = "account-row";
    const missing = Object.entries(account.configured || {})
      .filter(([, value]) => !value)
      .map(([name]) => name.toUpperCase())
      .join("、");
    row.innerHTML = `
      <div class="account-main">
        <div class="account-title">${account.label}</div>
        <span class="status-pill ${account.complete ? "ok" : "warn"}">${account.complete ? "完整配置" : `不完整：缺少 ${missing}`}</span>
      </div>
      <div class="account-meta">
        <span>平台：${account.platformLabel}</span>
        <span>邮箱：${account.email || "GitHub Secret 已配置时不可读取明文"}</span>
        <span>网址：${account.url || "GitHub Secret 已配置时不可读取明文"}</span>
      </div>
      <div class="account-actions">
        <button type="button" class="edit-account">修改</button>
        <button type="button" class="danger delete-account">删除</button>
      </div>
    `;
    row.querySelector(".edit-account").addEventListener("click", () => editAccount(account));
    row.querySelector(".delete-account").addEventListener("click", () => deleteAccount(account));
    list.appendChild(row);
  }
}

function editAccount(account) {
  addPlatformCard({
    id: `edit-${account.platform}-${account.slot}`,
    label: account.label,
    platform: account.platform,
    slot: account.slot,
    email: account.email || "",
    url: account.url || "",
  });
  showMessages([`已打开 ${account.label} 的修改表单。密码留空会保持旧密码。`], "warn");
}

async function deleteAccount(account) {
  const legacyText = account.slot === 1 ? "这是第一组旧配置，删除后该平台主账号会失效。" : "";
  const ok = window.confirm(`确认删除 ${account.label} 吗？${legacyText}\n将删除对应的 EMAIL、PASSWORD、URL 三个 GitHub Secret。`);
  if (!ok) {
    return;
  }
  setStatus("正在删除账号...");
  try {
    const result = await postJson("/api/delete-account", {
      githubToken: $("githubToken").value,
      repository: {
        owner: "Xuecheng377",
        name: "journal-status-monitor",
      },
      account: {
        platform: account.platform,
        slot: account.slot,
      },
    });
    showMessages([`已删除 ${result.label}：${result.deletedSecrets.join(", ")}`], "ok");
    await loadCurrentConfig();
  } catch (error) {
    setStatus("删除失败");
    showMessages(error.errors || [String(error)], "error");
  }
}

function collectActions() {
  return {
    deployCloudflare: $("deployCloudflare").checked,
    dispatchTest: $("dispatchTest").checked,
  };
}

function setStatus(text) {
  $("statusText").textContent = text;
}

function showMessages(items, type = "error") {
  const box = $("messages");
  box.innerHTML = "";
  for (const item of items) {
    const div = document.createElement("div");
    div.className = `message ${type}`;
    div.textContent = item;
    box.appendChild(div);
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok || body.ok === false) {
    throw body;
  }
  return body;
}

async function previewConfig() {
  setStatus("正在生成预览...");
  $("preview").textContent = "";
  showMessages([]);
  try {
    const result = await postJson("/api/preview", { settings: collectSettings(), existingSecrets });
    setStatus("预览已生成");
    const messages = [`将更新 ${result.secrets.length} 个 GitHub Secret：${result.secrets.join(", ") || "无"}`];
    if (result.keptSecrets?.length) {
      messages.push(`将保留 ${result.keptSecrets.length} 个旧 Secret：${result.keptSecrets.join(", ")}`);
    }
    showMessages(messages, "ok");
    $("preview").textContent = [
      "# cloudflare-scheduler/wrangler.toml",
      result.wranglerToml,
      "# 本地 .env 预览",
      result.envPreview.replace(/PASSWORD=.*/g, "PASSWORD=********"),
    ].join("\n");
  } catch (error) {
    setStatus("预览失败");
    showMessages(error.errors || [String(error)], "error");
  }
}

async function saveConfig() {
  setStatus("正在保存...");
  $("preview").textContent = "";
  showMessages(["请等待，正在写入 GitHub Secrets；如果勾选部署 Cloudflare，会继续执行部署。"], "warn");
  try {
    const result = await postJson("/api/save", {
      settings: collectSettings(),
      tokens: collectTokens(),
      actions: collectActions(),
      existingSecrets,
    });
    setStatus("保存完成");
    const messages = [
      `已更新 GitHub Secrets：${result.updatedSecrets.join(", ")}`,
      `已保留旧 GitHub Secrets：${result.keptSecrets?.join(", ") || "无"}`,
      `已更新本地调度文件：${result.wranglerPath}`,
    ];
    if (result.deployResult) {
      messages.push("Cloudflare Worker 已执行部署命令。");
    }
    if (result.workflowResult) {
      messages.push("已触发 GitHub Actions 测试邮件 workflow。");
    }
    showMessages(messages, "ok");
    $("preview").textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    setStatus("保存失败");
    showMessages(error.errors || [String(error)], "error");
    $("preview").textContent = JSON.stringify(error, null, 2);
  }
}

async function loadCurrentConfig() {
  setStatus("正在加载当前配置...");
  showMessages([]);
  try {
    const result = await postJson("/api/current", {
      githubToken: $("githubToken").value,
      repository: {
        owner: "Xuecheng377",
        name: "journal-status-monitor",
      },
    });
    applyCurrentConfig(result);
    setStatus("当前配置已加载");
    const count = Object.keys(existingSecrets).length;
    showMessages([count ? `已检测到 ${count} 个 GitHub Secret。敏感值不能读取原文，留空会保持不变。` : "已加载本地时间表。GitHub Secret 状态需要填写 token 后检查。"], count ? "ok" : "warn");
  } catch (error) {
    setStatus("加载失败");
    showMessages(error.errors || [String(error)], "error");
  }
}

$("previewBtn").addEventListener("click", previewConfig);
$("saveBtn").addEventListener("click", saveConfig);
$("loadBtn").addEventListener("click", loadCurrentConfig);
$("checkSecretsBtn").addEventListener("click", loadCurrentConfig);
$("addPlatformBtn").addEventListener("click", () => addPlatformCard());
$("refreshAccountsBtn").addEventListener("click", loadCurrentConfig);

loadCurrentConfig();
