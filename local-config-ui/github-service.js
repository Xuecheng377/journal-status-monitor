function repoApiBase(owner, repo) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "journal-status-local-config-ui",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  if (!response.ok) {
    throw new Error(body?.message || fallbackMessage || `GitHub request failed with HTTP ${response.status}`);
  }
  return body;
}

async function encryptSecret(value, publicKey, sodiumModule) {
  const sodium = sodiumModule || require("libsodium-wrappers");
  await sodium.ready;
  const keyBytes = sodium.from_base64(publicKey);
  const valueBytes = sodium.from_string(String(value));
  const encryptedBytes = sodium.crypto_box_seal(valueBytes, keyBytes);
  return sodium.to_base64(encryptedBytes);
}

async function getRepoPublicKey({ owner, repo, token, fetchImpl = fetch }) {
  const response = await fetchImpl(`${repoApiBase(owner, repo)}/actions/secrets/public-key`, {
    headers: githubHeaders(token),
  });
  return readJsonResponse(response, "Could not fetch repository public key.");
}

async function putRepoSecret({ owner, repo, token, name, value, fetchImpl = fetch, sodiumModule }) {
  const publicKey = await getRepoPublicKey({ owner, repo, token, fetchImpl });
  const encryptedValue = await encryptSecret(value, publicKey.key, sodiumModule);
  const response = await fetchImpl(`${repoApiBase(owner, repo)}/actions/secrets/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify({
      encrypted_value: encryptedValue,
      key_id: publicKey.key_id,
    }),
  });
  await readJsonResponse(response, `Could not update secret ${name}.`);
  return { name, status: "updated" };
}

async function dispatchWorkflow({ owner, repo, token, workflow = "monitor.yml", ref = "main", mode = "test", fetchImpl = fetch }) {
  const response = await fetchImpl(`${repoApiBase(owner, repo)}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify({
      ref,
      inputs: {
        mode,
        window: "manual",
      },
    }),
  });
  if (response.status === 204) {
    return { status: "dispatched", mode };
  }
  await readJsonResponse(response, "Could not dispatch workflow.");
  return { status: "dispatched", mode };
}

module.exports = {
  dispatchWorkflow,
  encryptSecret,
  getRepoPublicKey,
  githubHeaders,
  putRepoSecret,
  repoApiBase,
};
