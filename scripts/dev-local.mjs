import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const interfaces = Object.values(networkInterfaces())
  .flat()
  .filter((v) => v && v.family === "IPv4" && !v.internal);
const address =
  process.env.STACKSYNERGY_DEV_IP || process.env.CARDCHASM_DEV_IP ||
  interfaces.find((v) => v.address.startsWith("192.168."))?.address ||
  interfaces[0]?.address;
if (!address)
  throw Error("Connect the Mac to Wi-Fi before starting phone development.");
for (const port of [3001, 5173, 8081]) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        Error(
          `Port ${port} is already in use. Stop the previous StackSynergy session first.`,
        ),
      ),
    );
    probe.listen(port, "0.0.0.0", () => probe.close(resolve));
  });
}
const env = {
  ...process.env,
  HOST: "0.0.0.0",
  APP_ORIGIN: `http://${address}:5173`,
  APP_ORIGINS: "http://127.0.0.1:5173,http://localhost:5173",
  EXPO_PUBLIC_CARDCHASM_URL: `http://${address}:5173`,
  REACT_NATIVE_PACKAGER_HOSTNAME: address,
};
const children = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* Already stopped. */
    }
  }
}
function run(command, args, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: "inherit",
    detached: true,
  });
  children.push(child);
  child.on("error", (e) => {
    console.error(e.message);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
console.log(
  `\nSafari: http://127.0.0.1:5173\nPhone web: http://${address}:5173\nExpo Go: exp://${address}:8081\nKeep this terminal running.\n`,
);
run(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "--host",
  "0.0.0.0",
  "--port",
  "5173",
  "--strictPort",
]);
run(process.execPath, [
  "node_modules/tsx/dist/cli.mjs",
  "watch",
  "--env-file-if-exists=.env",
  "server/index.ts",
]);
run(
  process.execPath,
  [
    "node_modules/expo/bin/cli",
    "start",
    "--lan",
    "--port",
    "8081",
    ...(process.argv.includes("--ios") ? ["--ios"] : []),
  ],
  `${root}mobile`,
);
