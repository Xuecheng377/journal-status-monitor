const DEFAULT_OWNER = "Xuecheng377";
const DEFAULT_REPO = "journal-status-monitor";
const DEFAULT_WORKFLOW = "monitor.yml";
const DEFAULT_REF = "main";
const FALLBACK_MINUTES = [17, 27, 37];

const SECRET_FIELDS = [
  "IEEE_EMAIL",
  "IEEE_PASSWORD",
  "IEEE_URL",
  "ELSEVIER_EMAIL",
  "ELSEVIER_PASSWORD",
  "ELSEVIER_URL",
  "EMAIL_SENDER",
  "EMAIL_PASSWORD",
  "EMAIL_RECEIVER",
  "SMTP_SERVER",
  "SMTP_HOST",
  "SMTP_PORT",
  "ARCHIVE_TERMINAL",
  "INCLUDE_ARCHIVED_IN_REPORT",
  "TERMINAL_STATUS_KEYWORDS",
];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasValue(value) {
  return normalizeText(value).length > 0;
}

function assertHour(hour, label) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`${label} must be an integer hour from 0 to 23.`);
  }
}

function assertMinute(minute, label) {
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`${label} must be an integer minute from 0 to 59.`);
  }
}

function beijingHourToUtcHour(hour) {
  assertHour(hour, "Beijing hour");
  return (hour + 16) % 24;
}

function fallbackMinuteList(primaryMinute) {
  assertMinute(primaryMinute, "Primary minute");
  return Array.from(new Set([primaryMinute, ...FALLBACK_MINUTES])).sort((a, b) => a - b);
}

function buildCronExpressions(schedule) {
  const report = schedule?.weeklyReport || {};
  const normal = schedule?.normalChecks || {};
  const reportDay = Number.isInteger(report.dayOfWeek) ? report.dayOfWeek : 1;
  const reportHour = Number.isInteger(report.hour) ? report.hour : 8;
  const reportMinute = Number.isInteger(report.minute) ? report.minute : 17;
  const normalHours = Array.isArray(normal.hours) && normal.hours.length ? normal.hours : [11, 12, 14, 17, 20, 22];
  const normalMinute = Number.isInteger(normal.minute) ? normal.minute : 17;

  if (!Number.isInteger(reportDay) || reportDay < 0 || reportDay > 6) {
    throw new Error("Weekly report day must be 0-6, where 1 is Monday.");
  }
  assertHour(reportHour, "Weekly report hour");
  assertMinute(reportMinute, "Weekly report minute");
  normalHours.forEach((hour) => assertHour(hour, "Normal check hour"));
  assertMinute(normalMinute, "Normal check minute");

  const reportMinutes = fallbackMinuteList(reportMinute).join(",");
  const normalMinutes = fallbackMinuteList(normalMinute).join(",");
  const normalUtcHours = Array.from(new Set(normalHours.map(beijingHourToUtcHour))).sort((a, b) => a - b);
  return [
    `${reportMinutes} ${beijingHourToUtcHour(reportHour)} * * ${reportDay}`,
    `${normalMinutes} ${normalUtcHours.join(",")} * * *`,
  ];
}

function buildWranglerToml(settings) {
  const repo = settings?.repository || {};
  const crons = buildCronExpressions(settings?.schedule);
  return [
    'name = "journal-status-monitor-scheduler"',
    'main = "worker.js"',
    'compatibility_date = "2026-05-26"',
    "",
    "[vars]",
    `GITHUB_OWNER = "${normalizeText(repo.owner) || DEFAULT_OWNER}"`,
    `GITHUB_REPO = "${normalizeText(repo.name) || DEFAULT_REPO}"`,
    `GITHUB_WORKFLOW = "${normalizeText(repo.workflow) || DEFAULT_WORKFLOW}"`,
    `GITHUB_REF = "${normalizeText(repo.ref) || DEFAULT_REF}"`,
    "",
    "[triggers]",
    "crons = [",
    ...crons.map((cron, index) => `  "${cron}"${index === crons.length - 1 ? "" : ","}`),
    "]",
    "",
  ].join("\n");
}

function buildSecrets(settings) {
  const platforms = settings?.platforms || {};
  const email = settings?.email || {};
  const runtime = settings?.runtime || {};
  const values = {
    IEEE_EMAIL: platforms.ieee?.email,
    IEEE_PASSWORD: platforms.ieee?.password,
    IEEE_URL: platforms.ieee?.url,
    ELSEVIER_EMAIL: platforms.elsevier?.email,
    ELSEVIER_PASSWORD: platforms.elsevier?.password,
    ELSEVIER_URL: platforms.elsevier?.url,
    EMAIL_SENDER: email.sender,
    EMAIL_PASSWORD: email.password,
    EMAIL_RECEIVER: email.receivers,
    SMTP_SERVER: email.smtpServer,
    SMTP_HOST: email.smtpServer,
    SMTP_PORT: email.smtpPort,
    ARCHIVE_TERMINAL: runtime.archiveTerminal === false ? "false" : "true",
    INCLUDE_ARCHIVED_IN_REPORT: runtime.includeArchivedInReport ? "true" : "false",
    TERMINAL_STATUS_KEYWORDS: runtime.terminalStatusKeywords,
  };

  return Object.fromEntries(
    SECRET_FIELDS.map((name) => [name, normalizeText(values[name])]).filter(([, value]) => hasValue(value)),
  );
}

function buildEnvPreview(settings) {
  return Object.entries(buildSecrets(settings))
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");
}

function validateSettings(settings) {
  const errors = [];
  const secrets = buildSecrets(settings);
  const ieeeNames = ["IEEE_EMAIL", "IEEE_PASSWORD", "IEEE_URL"];
  const elsevierNames = ["ELSEVIER_EMAIL", "ELSEVIER_PASSWORD", "ELSEVIER_URL"];
  const ieeeAny = ieeeNames.some((name) => secrets[name]);
  const ieeeAll = ieeeNames.every((name) => secrets[name]);
  const elsevierAny = elsevierNames.some((name) => secrets[name]);
  const elsevierAll = elsevierNames.every((name) => secrets[name]);

  if (ieeeAny && !ieeeAll) {
    errors.push("IEEE 配置不完整：邮箱、密码、网址必须同时填写。");
  }
  if (elsevierAny && !elsevierAll) {
    errors.push("Elsevier 配置不完整：邮箱、密码、网址必须同时填写。");
  }
  if (!ieeeAll && !elsevierAll) {
    errors.push("至少需要完整配置一个投稿平台。");
  }
  for (const name of ["EMAIL_SENDER", "EMAIL_PASSWORD", "EMAIL_RECEIVER"]) {
    if (!secrets[name]) {
      errors.push(`${name} 必填。`);
    }
  }

  try {
    buildCronExpressions(settings?.schedule);
  } catch (error) {
    errors.push(error.message);
  }

  return errors;
}

module.exports = {
  DEFAULT_OWNER,
  DEFAULT_REPO,
  DEFAULT_WORKFLOW,
  DEFAULT_REF,
  SECRET_FIELDS,
  beijingHourToUtcHour,
  buildCronExpressions,
  buildEnvPreview,
  buildSecrets,
  buildWranglerToml,
  validateSettings,
};
