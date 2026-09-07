#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectMobileReleaseConfig,
  releaseBuildArgs,
} from "./lib/mobile-release-config.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const [platform, definesPath, mode] = args;
if (args.length < 2 || args.length > 3 || (mode && mode !== "--build")) {
  console.error(
    "Usage: pnpm verify:mobile-release <android|ios> /absolute/path/to/defines.json [--build]",
  );
  process.exit(1);
}
const config = inspectMobileReleaseConfig({ repoRoot, platform, definesPath });
if (config.errors.length > 0) {
  console.error("Mobile production release configuration failed:");
  for (const error of config.errors) console.error(`- ${error}`);
  process.exit(1);
}

if (platform === "android") {
  const signing = spawnSync(
    process.platform === "win32" ? "gradlew.bat" : "./gradlew",
    [":app:verifySchoolosReleaseConfiguration", "--console=plain"],
    { cwd: join(config.mobileRoot, "android"), stdio: "inherit", shell: false },
  );
  if (signing.error || signing.status !== 0) {
    console.error(
      "Android release identity/signing validation failed. No release build was started.",
    );
    process.exit(1);
  }
}
console.log(
  "Mobile release configuration preflight passed; store signing, delivery, size, and device evidence remain separate gates.",
);

if (mode === "--build") {
  // Flutter consumes the same file that was checked. Do not accept additional
  // dart-define overrides that could silently change production configuration.
  const build = spawnSync(
    "flutter",
    releaseBuildArgs(platform, config.definesPath),
    {
      cwd: config.mobileRoot,
      stdio: "inherit",
      shell: false,
    },
  );
  if (build.error || build.status !== 0) {
    console.error("Mobile release build failed.");
    process.exit(1);
  }
}
