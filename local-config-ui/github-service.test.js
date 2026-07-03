const assert = require("node:assert/strict");
const test = require("node:test");
const { deleteRepoSecret, encryptSecret, githubHeaders, repoApiBase } = require("./github-service");

test("builds GitHub API base URL", () => {
  assert.equal(repoApiBase("owner", "repo"), "https://api.github.com/repos/owner/repo");
});

test("builds GitHub headers without leaking token shape", () => {
  const headers = githubHeaders("test-token");
  assert.equal(headers.Authorization, "Bearer test-token");
  assert.equal(headers.Accept, "application/vnd.github+json");
  assert.equal(headers["X-GitHub-Api-Version"], "2022-11-28");
});

test("encrypts GitHub secret using provided sodium-like implementation", async () => {
  const fakeSodium = {
    ready: Promise.resolve(),
    from_base64(value) {
      return Buffer.from(value, "base64");
    },
    from_string(value) {
      return Buffer.from(value, "utf8");
    },
    crypto_box_seal(message, key) {
      return Buffer.concat([Buffer.from("sealed:"), key, Buffer.from(":"), message]);
    },
    to_base64(value) {
      return Buffer.from(value).toString("base64");
    },
  };
  const encrypted = await encryptSecret("secret-value", Buffer.from("public-key").toString("base64"), fakeSodium);
  assert.equal(Buffer.from(encrypted, "base64").toString("utf8"), "sealed:public-key:secret-value");
});

test("retries GitHub public key decoding with no-padding base64 variant", async () => {
  const calls = [];
  const fakeSodium = {
    ready: Promise.resolve(),
    base64_variants: {
      ORIGINAL: "original",
      ORIGINAL_NO_PADDING: "original_no_padding",
    },
    from_base64(value, variant) {
      calls.push(variant);
      if (variant !== "original_no_padding") {
        throw new Error("incomplete input");
      }
      return Buffer.from(value, "base64");
    },
    from_string(value) {
      return Buffer.from(value, "utf8");
    },
    crypto_box_seal(message, key) {
      return Buffer.concat([Buffer.from("sealed:"), key, Buffer.from(":"), message]);
    },
    to_base64(value) {
      return Buffer.from(value).toString("base64");
    },
  };

  const encrypted = await encryptSecret("secret-value", Buffer.from("public-key").toString("base64").replace(/=+$/, ""), fakeSodium);

  assert.deepEqual(calls, ["original", undefined, "original_no_padding"]);
  assert.equal(Buffer.from(encrypted, "base64").toString("utf8"), "sealed:public-key:secret-value");
});

test("decodes padded GitHub public keys with original base64 variant", async () => {
  const calls = [];
  const fakeSodium = {
    ready: Promise.resolve(),
    base64_variants: {
      ORIGINAL: "original",
      ORIGINAL_NO_PADDING: "original_no_padding",
    },
    from_base64(value, variant) {
      calls.push(variant);
      if (variant !== "original") {
        throw new Error("incomplete input");
      }
      return Buffer.from(value, "base64");
    },
    from_string(value) {
      return Buffer.from(value, "utf8");
    },
    crypto_box_seal(message, key) {
      return Buffer.concat([Buffer.from("sealed:"), key, Buffer.from(":"), message]);
    },
    to_base64(value) {
      return Buffer.from(value).toString("base64");
    },
  };

  const encrypted = await encryptSecret("secret-value", Buffer.from("public-key").toString("base64"), fakeSodium);

  assert.equal(calls[0], "original");
  assert.equal(Buffer.from(encrypted, "base64").toString("utf8"), "sealed:public-key:secret-value");
});

test("encodes encrypted GitHub secret as standard padded base64", async () => {
  const fakeSodium = {
    ready: Promise.resolve(),
    base64_variants: {
      ORIGINAL: "original",
    },
    from_base64(value) {
      return Buffer.from(value, "base64");
    },
    from_string(value) {
      return Buffer.from(value, "utf8");
    },
    crypto_box_seal() {
      return Buffer.from([251, 255, 254, 253]);
    },
    to_base64(value, variant) {
      if (variant === "original") {
        return Buffer.from(value).toString("base64");
      }
      return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },
  };

  const encrypted = await encryptSecret("secret-value", Buffer.from("public-key").toString("base64"), fakeSodium);

  assert.equal(encrypted, "+//+/Q==");
  assert.match(encrypted, /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
});

test("deletes GitHub repository secrets", async () => {
  const calls = [];
  const result = await deleteRepoSecret({
    owner: "owner",
    repo: "repo",
    token: "token",
    name: "IEEE_2_EMAIL",
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options.method });
      return {
        ok: true,
        status: 204,
        text: async () => "",
      };
    },
  });

  assert.equal(result.name, "IEEE_2_EMAIL");
  assert.equal(result.status, "deleted");
  assert.deepEqual(calls, [
    {
      url: "https://api.github.com/repos/owner/repo/actions/secrets/IEEE_2_EMAIL",
      method: "DELETE",
    },
  ]);
});
