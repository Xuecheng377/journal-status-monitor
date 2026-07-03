const $ = (id) => document.getElementById(id);

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

function collectSettings() {
  return {
    repository: {
      owner: "Xuecheng377",
      name: "journal-status-monitor",
      workflow: "monitor.yml",
      ref: "main",
    },
    platforms: {
      ieee: {
        url: $("ieeeUrl").value,
        email: $("ieeeEmail").value,
        password: $("ieeePassword").value,
      },
      elsevier: {
        url: $("elsevierUrl").value,
        email: $("elsevierEmail").value,
        password: $("elsevierPassword").value,
      },
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
    const result = await postJson("/api/preview", { settings: collectSettings() });
    setStatus("预览已生成");
    showMessages([`将更新 ${result.secrets.length} 个 GitHub Secret：${result.secrets.join(", ")}`], "ok");
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
    });
    setStatus("保存完成");
    const messages = [
      `已更新 GitHub Secrets：${result.updatedSecrets.join(", ")}`,
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

$("previewBtn").addEventListener("click", previewConfig);
$("saveBtn").addEventListener("click", saveConfig);
