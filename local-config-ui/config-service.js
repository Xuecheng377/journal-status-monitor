const DEFAULT_OWNER = "Xuecheng377";
const DEFAULT_REPO = "journal-status-monitor";
const DEFAULT_WORKFLOW = "monitor.yml";
const DEFAULT_REF = "main";
const FALLBACK_MINUTES = [17, 27, 37];
const KEEP_EXISTING_SECRET = "__KEEP_EXISTING_SECRET__";
const MAX_PLATFORM_SLOTS = 5;
const PLATFORM_KINDS = [
  { key: "ieee", label: "IEEE ScholarOne", prefix: "IEEE" },
  { key: "elsevier", label: "Elsevier Editorial Manager", prefix: "ELSEVIER" },
];

const RUNTIME_SECRET_FIELDS = [
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
const SECRET_FIELDS = [...platformSecretFields(), ...RUNTIME_SECRET_FIELDS];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasValue(value) {
  return normalizeText(value).length > 0;
}

function platformSecretFields() {
  const fields = [];
  for (const kind of PLATFORM_KINDS) {
    for (let slot = 1; slot <= MAX_PLATFORM_SLOTS; slot += 1) {
      const prefix = slot === 1 ? kind.prefix : `${kind.prefix}_${slot}`;
      fields.push(`${prefix}_EMAIL`, `${prefix}_PASSWORD`, `${prefix}_URL`);
    }
  }
  return fields;
}

function normalizePlatformKey(value) {
  const text = normalizeText(value).toLowerCase();
  if (["ieee", "scholarone", "scholar_one"].includes(text) || text.includes("ieee")) {
    return "ieee";
  }
  if (["elsevier", "editorialmanager", "editorial_manager"].includes(text) || text.includes("elsevier")) {
    return "elsevier";
  }
  return "";
}

function platformKind(platform) {
  const key = normalizePlatformKey(platform);
  return PLATFORM_KINDS.find((kind) => kind.key === key);
}

function platformSecretNames(platform, slot) {
  const kind = platformKind(platform);
  if (!kind) {
    throw new Error("新增投稿平台类型必须是 IEEE 或 Elsevier。");
  }
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_PLATFORM_SLOTS) {
    throw new Error(`投稿平台槽位必须是 1-${MAX_PLATFORM_SLOTS}。`);
  }
  const prefix = slot === 1 ? kind.prefix : `${kind.prefix}_${slot}`;
  return {
    email: `${prefix}_EMAIL`,
    password: `${prefix}_PASSWORD`,
    url: `${prefix}_URL`,
  };
}

function platformSlotLabel(platform, slot) {
  const kind = platformKind(platform);
  if (!kind) {
    throw new Error("投稿平台类型必须是 IEEE 或 Elsevier。");
  }
  return slot === 1 ? kind.prefix : `${kind.prefix}_${slot}`;
}

function slotHasAnyValue(names, source) {
  return [names.email, names.password, names.url].some((name) => {
    const value = source?.[name];
    return value === KEEP_EXISTING_SECRET || value === true || hasValue(value);
  });
}

function nextAvailablePlatformSlot(platform, existingSecrets, plannedSecrets) {
  for (let slot = 2; slot <= MAX_PLATFORM_SLOTS; slot += 1) {
    const names = platformSecretNames(platform, slot);
    if (!slotHasAnyValue(names, existingSecrets) && !slotHasAnyValue(names, plannedSecrets)) {
      return slot;
    }
  }
  const kind = platformKind(platform);
  throw new Error(`${kind?.label || platform} 已达到 ${MAX_PLATFORM_SLOTS} 个账号上限。`);
}

function assignPlatformValues(values, platform, slot, account) {
  const names = platformSecretNames(platform, slot);
  values[names.email] = account?.email;
  values[names.password] = account?.password;
  values[names.url] = account?.url;
}

function hasAnyPlatformInput(account) {
  return hasValue(account?.email) || hasValue(account?.password) || hasValue(account?.url);
}

function listPlatformAccounts(existingSecrets = {}, metadata = {}) {
  const accounts = [];
  for (const kind of PLATFORM_KINDS) {
    for (let slot = 1; slot <= MAX_PLATFORM_SLOTS; slot += 1) {
      const label = platformSlotLabel(kind.key, slot);
      const names = platformSecretNames(kind.key, slot);
      const configured = {
        email: Boolean(existingSecrets[names.email]),
        password: Boolean(existingSecrets[names.password]),
        url: Boolean(existingSecrets[names.url]),
      };
      const local = metadata[label] || {};
      const visible = configured.email || configured.password || configured.url || Boolean(local.email || local.url);
      if (!visible) {
        continue;
      }
      accounts.push({
        platform: kind.key,
        platformLabel: kind.label,
        slot,
        label,
        secretNames: names,
        configured,
        complete: configured.email && configured.password && configured.url,
        email: normalizeText(local.email),
        url: normalizeText(local.url),
        updatedAt: normalizeText(local.updatedAt),
      });
    }
  }
  return accounts;
}

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings || {}));
}

function assignPlatformAdditionSlots(settings, existingSecrets = {}, previousAssignments = {}) {
  const nextSettings = cloneSettings(settings);
  const additions = Array.isArray(nextSettings?.platformAccounts?.additions) ? nextSettings.platformAccounts.additions : [];
  const assignments = { ...(previousAssignments || {}) };
  const plannedSecrets = {};

  for (const addition of additions) {
    if (!hasAnyPlatformInput(addition)) {
      continue;
    }
    const platform = normalizePlatformKey(addition.platform);
    if (!platform) {
      throw new Error("新增投稿平台类型必须是 IEEE 或 Elsevier。");
    }

    let slot = Number.isInteger(addition.slot) ? addition.slot : null;
    const existingAssignment = addition.id ? assignments[addition.id] : null;
    if (!slot && existingAssignment?.platform === platform && Number.isInteger(existingAssignment.slot)) {
      slot = existingAssignment.slot;
    }
    if (!slot) {
      slot = nextAvailablePlatformSlot(platform, existingSecrets, plannedSecrets);
    }

    addition.platform = platform;
    addition.slot = slot;
    assignPlatformValues(plannedSecrets, platform, slot, addition);
    if (addition.id) {
      assignments[addition.id] = { platform, slot };
    }
  }

  return { settings: nextSettings, assignments };
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

function utcHourToBeijingHour(hour) {
  assertHour(hour, "UTC hour");
  return (hour + 8) % 24;
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

function buildSecrets(settings, options = {}) {
  const platforms = settings?.platforms || {};
  const additions = Array.isArray(settings?.platformAccounts?.additions) ? settings.platformAccounts.additions : [];
  const email = settings?.email || {};
  const runtime = settings?.runtime || {};
  const values = {
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

  if (platforms.ieee) {
    assignPlatformValues(values, "ieee", 1, platforms.ieee);
  }
  if (platforms.elsevier) {
    assignPlatformValues(values, "elsevier", 1, platforms.elsevier);
  }
  for (const addition of additions) {
    if (!hasAnyPlatformInput(addition)) {
      continue;
    }
    const platform = normalizePlatformKey(addition.platform);
    if (!platform) {
      throw new Error("新增投稿平台类型必须是 IEEE 或 Elsevier。");
    }
    const slot = Number.isInteger(addition.slot)
      ? addition.slot
      : nextAvailablePlatformSlot(platform, options.existingSecrets || {}, values);
    assignPlatformValues(values, platform, slot, addition);
  }

  return Object.fromEntries(
    SECRET_FIELDS.map((name) => [name, normalizeText(values[name])]).filter(([, value]) => hasValue(value)),
  );
}

function mergeExistingSecretValues(settings, existingSecrets = {}) {
  const secrets = buildSecrets(settings, { existingSecrets });
  for (const name of SECRET_FIELDS) {
    if (!secrets[name] && existingSecrets[name]) {
      secrets[name] = KEEP_EXISTING_SECRET;
    }
  }
  return secrets;
}

function buildEnvPreview(settings, existingSecrets = {}) {
  return Object.entries(buildSecrets(settings, { existingSecrets }))
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");
}

function activeSecrets(settings, existingSecrets = {}) {
  return mergeExistingSecretValues(settings, existingSecrets);
}

function validateSettings(settings, options = {}) {
  const errors = [];
  let secrets = {};
  try {
    secrets = activeSecrets(settings, options.existingSecrets || {});
  } catch (error) {
    errors.push(error.message);
  }

  let hasCompletePlatform = false;
  for (const kind of PLATFORM_KINDS) {
    for (let slot = 1; slot <= MAX_PLATFORM_SLOTS; slot += 1) {
      const names = platformSecretNames(kind.key, slot);
      const fieldNames = [names.email, names.password, names.url];
      const any = fieldNames.some((name) => secrets[name]);
      const all = fieldNames.every((name) => secrets[name]);
      const label = slot === 1 ? kind.prefix : `${kind.prefix}_${slot}`;
      if (any && !all) {
        errors.push(`${label} 配置不完整：邮箱、密码、网址必须同时填写。`);
      }
      hasCompletePlatform = hasCompletePlatform || all;
    }
  }

  if (!hasCompletePlatform) {
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

function parseVars(toml) {
  const vars = {};
  for (const match of toml.matchAll(/^(GITHUB_OWNER|GITHUB_REPO|GITHUB_WORKFLOW|GITHUB_REF)\s*=\s*"([^"]*)"/gm)) {
    vars[match[1]] = match[2];
  }
  return vars;
}

function firstNumberListPart(value) {
  return value
    .split(",")
    .map((item) => Number.parseInt(item, 10))
    .filter((number) => Number.isInteger(number));
}

function parseWranglerToml(toml) {
  const vars = parseVars(toml || "");
  const crons = Array.from((toml || "").matchAll(/"([^"]+\s+\S+\s+\*\s+\*\s+\S+)"/g)).map((match) => match[1]);
  const reportCron = crons.find((cron) => !cron.endsWith("*")) || "17,27,37 0 * * 1";
  const normalCron = crons.find((cron) => cron.endsWith("*")) || "17,27,37 3,4,6,9,12,14 * * *";
  const reportParts = reportCron.split(/\s+/);
  const normalParts = normalCron.split(/\s+/);
  const reportMinute = firstNumberListPart(reportParts[0])[0] || 17;
  const reportHour = utcHourToBeijingHour(Number.parseInt(reportParts[1], 10));
  const reportDay = Number.parseInt(reportParts[4], 10);
  const normalMinute = firstNumberListPart(normalParts[0])[0] || 17;
  const normalHours = firstNumberListPart(normalParts[1]).map(utcHourToBeijingHour).sort((a, b) => a - b);

  return {
    repository: {
      owner: vars.GITHUB_OWNER || DEFAULT_OWNER,
      name: vars.GITHUB_REPO || DEFAULT_REPO,
      workflow: vars.GITHUB_WORKFLOW || DEFAULT_WORKFLOW,
      ref: vars.GITHUB_REF || DEFAULT_REF,
    },
    schedule: {
      weeklyReport: {
        dayOfWeek: Number.isInteger(reportDay) ? reportDay : 1,
        hour: reportHour,
        minute: reportMinute,
      },
      normalChecks: {
        hours: normalHours.length ? normalHours : [11, 12, 14, 17, 20, 22],
        minute: normalMinute,
      },
    },
  };
}

module.exports = {
  DEFAULT_OWNER,
  DEFAULT_REPO,
  DEFAULT_WORKFLOW,
  DEFAULT_REF,
  MAX_PLATFORM_SLOTS,
  KEEP_EXISTING_SECRET,
  PLATFORM_KINDS,
  SECRET_FIELDS,
  assignPlatformAdditionSlots,
  beijingHourToUtcHour,
  buildCronExpressions,
  buildEnvPreview,
  buildSecrets,
  buildWranglerToml,
  listPlatformAccounts,
  mergeExistingSecretValues,
  parseWranglerToml,
  platformSlotLabel,
  platformSecretNames,
  validateSettings,
};
