const DEFAULT_OWNER = "Xuecheng377";
const DEFAULT_REPO = "journal-status-monitor";
const DEFAULT_WORKFLOW = "monitor.yml";
const DEFAULT_REF = "main";

const DAILY_REPORT_HOUR = 8;
const WEEKLY_REPORT_DAY = 1;
const NORMAL_HOURS = new Set([11, 12, 14, 17, 20, 22]);
const FALLBACK_MINUTES = new Set([17, 27, 37]);
const LOOKBACK_MINUTES = 45;

function beijingTime(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

function formatBeijingTime(date = new Date()) {
  const bj = beijingTime(date);
  return `${bj.getUTCFullYear()}-${String(bj.getUTCMonth() + 1).padStart(2, "0")}-${String(
    bj.getUTCDate(),
  ).padStart(2, "0")} ${String(bj.getUTCHours()).padStart(2, "0")}:${String(
    bj.getUTCMinutes(),
  ).padStart(2, "0")}:${String(bj.getUTCSeconds()).padStart(2, "0")}`;
}

function resolveMode(date = new Date()) {
  const bj = beijingTime(date);
  const day = bj.getUTCDay();
  const hour = bj.getUTCHours();
  const minute = bj.getUTCMinutes();

  if (!FALLBACK_MINUTES.has(minute)) {
    return null;
  }
  if (day === WEEKLY_REPORT_DAY && hour === DAILY_REPORT_HOUR) {
    return "daily_report";
  }
  if (NORMAL_HOURS.has(hour)) {
    return "normal";
  }
  return null;
}

function resolveWindow(date = new Date()) {
  const bj = beijingTime(date);
  const mode = resolveMode(date);
  if (!mode) {
    return null;
  }
  return {
    mode,
    key: `${bj.getUTCFullYear()}-${String(bj.getUTCMonth() + 1).padStart(2, "0")}-${String(
      bj.getUTCDate(),
    ).padStart(2, "0")}T${String(bj.getUTCHours()).padStart(2, "0")}`,
    label: `${bj.getUTCFullYear()}-${String(bj.getUTCMonth() + 1).padStart(2, "0")}-${String(
      bj.getUTCDate(),
    ).padStart(2, "0")} ${String(bj.getUTCHours()).padStart(2, "0")}:17`,
  };
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "journal-status-external-scheduler",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function getWorkflowRuns(env, token) {
  const owner = env.GITHUB_OWNER || DEFAULT_OWNER;
  const repo = env.GITHUB_REPO || DEFAULT_REPO;
  const workflow = env.GITHUB_WORKFLOW || DEFAULT_WORKFLOW;
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=20`,
    {
      headers: githubHeaders(token),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub run lookup failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function alreadyDispatchedForWindow(env, token, window) {
  const runs = await getWorkflowRuns(env, token);
  const now = new Date();
  const threshold = now.getTime() - LOOKBACK_MINUTES * 60 * 1000;
  return (runs.workflow_runs || []).some((run) => {
    const createdAt = Date.parse(run.created_at || "");
    if (!Number.isFinite(createdAt) || createdAt < threshold) {
      return false;
    }
    const title = String(run.display_title || "");
    const sameWindow = title.includes(`window=${window.key}`) || title.includes(`window=${window.label}`);
    if (!sameWindow) {
      return false;
    }
    return run.status !== "completed" || run.conclusion === "success";
  });
}

async function dispatchWorkflow(env, window) {
  const owner = env.GITHUB_OWNER || DEFAULT_OWNER;
  const repo = env.GITHUB_REPO || DEFAULT_REPO;
  const workflow = env.GITHUB_WORKFLOW || DEFAULT_WORKFLOW;
  const ref = env.GITHUB_REF || DEFAULT_REF;
  const token = env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN secret.");
  }

  if (await alreadyDispatchedForWindow(env, token, window)) {
    console.log(`Skipped duplicate fallback for Beijing window ${window.label}.`);
    return "skipped";
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        ...githubHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          mode: window.mode,
          window: window.key,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub dispatch failed: ${response.status} ${body}`);
  }
  return "triggered";
}

export default {
  async scheduled(event, env, ctx) {
    const scheduledAt = event.scheduledTime ? new Date(event.scheduledTime) : new Date();
    const window = resolveWindow(scheduledAt);
    if (!window) {
      console.log("Outside configured Beijing trigger windows; skipped.");
      return;
    }

    ctx.waitUntil(
      dispatchWorkflow(env, window).then((result) => {
        console.log(`${result} GitHub workflow_dispatch with mode=${window.mode}, window=${window.key}.`);
      }),
    );
  },

  async fetch(request, env) {
    const window = resolveWindow();
    return Response.json({
      ok: true,
      beijingTime: formatBeijingTime(),
      modeIfScheduledNow: window?.mode || null,
      windowIfScheduledNow: window?.key || null,
      repository: `${env.GITHUB_OWNER || DEFAULT_OWNER}/${env.GITHUB_REPO || DEFAULT_REPO}`,
      workflow: env.GITHUB_WORKFLOW || DEFAULT_WORKFLOW,
    });
  },
};
