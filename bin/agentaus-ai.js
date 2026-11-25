#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".agentaus-ai");

fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();

    let value = "";

    function onData(char) {
      const code = char.toString();

      if (code === "\u0003") {
        stdin.setRawMode(false);
        process.exit(1);
      }

      if (code === "\r" || code === "\n") {
        stdin.removeListener("data", onData);
        stdin.setRawMode(false);
        stdout.write("\n");
        resolve(value);
      } else if (code === "\u007f") {
        value = value.slice(0, -1);
      } else if (code >= " ") {
        value += code;
      }
    }

    stdin.on("data", onData);
  });

}
async function getApiKey() {
  const key = await askHidden("Enter your Agentaus API key: ");

  if (!key.trim()) {
    console.error("API key is required.");
    process.exit(1);
  }

  return key.trim();
}

async function main() {
  const apiKey = await getApiKey();

  const configPath = path.join(CONFIG_DIR, "opencode.json");

  const config = {
    "$schema": "https://opencode.ai/config.json",
    "model": "trellisdata/agentaus.v1",
    "provider": {
      "trellisdata": {
        "npm": "@ai-sdk/openai-compatible",
        "name": "Trellis Data",
        "options": {
          "baseURL": "https://agentaus.com.au/api/v1",
          "apiKey": "{env:AGENTAUS_API_KEY}"
        },
        "models": {
          "agentaus.v1": {
            "name": "Agentaus V1"
          }
        }
      }
    }
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600
  });

  const result = spawnSync("opencode", [], {
  stdio: "inherit",
  env: {
    ...process.env,
    AGENTAUS_API_KEY: apiKey,
    OPENCODE_CONFIG: configPath
  }
});

  if (result.error) {
    console.error("Could not start OpenCode:", result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main().catch(console.error);
