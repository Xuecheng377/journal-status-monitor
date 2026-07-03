const assert = require("node:assert/strict");
const test = require("node:test");
const {
  beijingHourToUtcHour,
  buildCronExpressions,
  buildSecrets,
  mergeExistingSecretValues,
  parseWranglerToml,
  buildWranglerToml,
  validateSettings,
} = require("./config-service");

function completeSettings() {
  return {
    repository: {
      owner: "Xuecheng377",
      name: "journal-status-monitor",
      workflow: "monitor.yml",
      ref: "main",
    },
    platforms: {
      ieee: {
        email: "author@example.com",
        password: "ieee-password",
        url: "https://mc.manuscriptcentral.com/example",
      },
      elsevier: {
        email: "",
        password: "",
        url: "",
      },
    },
    email: {
      sender: "sender@example.com",
      password: "smtp-secret",
      receivers: "receiver@example.com",
      smtpServer: "smtp.example.com",
      smtpPort: "465",
    },
    schedule: {
      weeklyReport: { dayOfWeek: 1, hour: 8, minute: 17 },
      normalChecks: { hours: [11, 12, 14, 17, 20, 22], minute: 17 },
    },
    runtime: {
      archiveTerminal: true,
      includeArchivedInReport: false,
      terminalStatusKeywords: "accept,accepted,published,rejected,withdrawn",
    },
  };
}

test("converts Beijing hours to UTC hours", () => {
  assert.equal(beijingHourToUtcHour(8), 0);
  assert.equal(beijingHourToUtcHour(22), 14);
});

test("builds Cloudflare cron expressions with fallback minutes", () => {
  assert.deepEqual(buildCronExpressions(completeSettings().schedule), [
    "17,27,37 0 * * 1",
    "17,27,37 3,4,6,9,12,14 * * *",
  ]);
});

test("builds GitHub secrets without empty optional platform values", () => {
  const secrets = buildSecrets(completeSettings());
  assert.equal(secrets.IEEE_EMAIL, "author@example.com");
  assert.equal(secrets.IEEE_PASSWORD, "ieee-password");
  assert.equal(secrets.EMAIL_PASSWORD, "smtp-secret");
  assert.equal(secrets.ARCHIVE_TERMINAL, "true");
  assert.equal(secrets.INCLUDE_ARCHIVED_IN_REPORT, "false");
  assert.equal(Object.hasOwn(secrets, "ELSEVIER_PASSWORD"), false);
});

test("validates incomplete platform settings", () => {
  const settings = completeSettings();
  settings.platforms.ieee.password = "";
  const errors = validateSettings(settings);
  assert.equal(errors.some((error) => error.includes("IEEE 配置不完整")), true);
});

test("builds wrangler toml with repository variables and crons", () => {
  const toml = buildWranglerToml(completeSettings());
  assert.match(toml, /GITHUB_OWNER = "Xuecheng377"/);
  assert.match(toml, /GITHUB_REPO = "journal-status-monitor"/);
  assert.match(toml, /"17,27,37 0 \* \* 1"/);
  assert.match(toml, /"17,27,37 3,4,6,9,12,14 \* \* \*"/);
});

test("keeps existing secret values when form field is blank", () => {
  const settings = completeSettings();
  settings.platforms.ieee.password = "";
  settings.email.password = "";
  const merged = mergeExistingSecretValues(settings, {
    IEEE_PASSWORD: true,
    EMAIL_PASSWORD: true,
  });
  assert.equal(merged.IEEE_PASSWORD, "__KEEP_EXISTING_SECRET__");
  assert.equal(merged.EMAIL_PASSWORD, "__KEEP_EXISTING_SECRET__");
  assert.equal(Object.hasOwn(merged, "IEEE_EMAIL"), true);
});

test("validates blank secret fields when an existing secret is present", () => {
  const settings = completeSettings();
  settings.platforms.ieee.password = "";
  settings.email.password = "";
  const errors = validateSettings(settings, {
    existingSecrets: {
      IEEE_PASSWORD: true,
      EMAIL_PASSWORD: true,
    },
  });
  assert.deepEqual(errors, []);
});

test("parses current wrangler toml schedule into form settings", () => {
  const parsed = parseWranglerToml(`name = "journal-status-monitor-scheduler"
[vars]
GITHUB_OWNER = "Xuecheng377"
GITHUB_REPO = "journal-status-monitor"
GITHUB_WORKFLOW = "monitor.yml"
GITHUB_REF = "main"
[triggers]
crons = [
  "17,27,37 0 * * 1",
  "17,27,37 3,4,6,9,12,14 * * *"
]`);
  assert.equal(parsed.repository.owner, "Xuecheng377");
  assert.equal(parsed.schedule.weeklyReport.dayOfWeek, 1);
  assert.equal(parsed.schedule.weeklyReport.hour, 8);
  assert.deepEqual(parsed.schedule.normalChecks.hours, [11, 12, 14, 17, 20, 22]);
});
