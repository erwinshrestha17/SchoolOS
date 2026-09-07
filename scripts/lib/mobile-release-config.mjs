import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const firebaseNames = [
  "SCHOOL_OS_FIREBASE_API_KEY",
  "SCHOOL_OS_FIREBASE_APP_ID",
  "SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID",
  "SCHOOL_OS_FIREBASE_PROJECT_ID",
];
const allowedDefines = new Set([
  "SCHOOL_OS_ENV",
  "SCHOOL_OS_API_BASE_URL",
  ...firebaseNames,
  "SCHOOL_OS_FIREBASE_STORAGE_BUCKET",
]);

export function validateMobileReleaseValues({ platform, env = {} }) {
  const errors = [];
  if (!["android", "ios"].includes(platform)) {
    return ["Choose the release platform: android or ios"];
  }
  if (!env || typeof env !== "object" || Array.isArray(env)) {
    return ["The Dart define file must contain a JSON object of string values"];
  }
  // These values are compiled into a distributable client, not a secret store.
  if (Object.keys(env).some((key) => !allowedDefines.has(key))) {
    errors.push(
      "The Dart define file contains unsupported keys; use only documented mobile configuration",
    );
  }
  if (Object.values(env).some((value) => typeof value !== "string")) {
    errors.push("Dart define values must all be strings");
  }
  if (env.SCHOOL_OS_ENV !== "production") {
    errors.push("SCHOOL_OS_ENV must be production");
  }
  validateProductionApiUrl(errors, env.SCHOOL_OS_API_BASE_URL);

  for (const name of firebaseNames) {
    if (!hasValue(env[name]) || isPlaceholder(env[name])) {
      errors.push(`${name} must be configured for the registered Firebase app`);
    }
  }
  const sender = env.SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID;
  if (hasValue(sender) && !/^[0-9]+$/.test(sender)) {
    errors.push("SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID must be numeric");
  }
  const appId = env.SCHOOL_OS_FIREBASE_APP_ID;
  const appIdParts =
    typeof appId === "string"
      ? appId.match(/^1:([0-9]+):(android|ios):[A-Za-z0-9]+$/)
      : null;
  if (!appIdParts || appIdParts[2] !== platform) {
    errors.push(
      `SCHOOL_OS_FIREBASE_APP_ID must identify the ${platform} Firebase app`,
    );
  } else if (appIdParts[1] !== sender) {
    errors.push(
      "Firebase app ID and messaging sender ID must refer to the same project number",
    );
  }
  return errors;
}

export function inspectMobileReleaseConfig({
  repoRoot,
  platform,
  definesPath,
}) {
  const errors = [];
  let env;
  const absoluteDefinesPath = definesPath ? resolve(definesPath) : undefined;
  try {
    if (!absoluteDefinesPath || !isFile(absoluteDefinesPath)) throw new Error();
    env = JSON.parse(readFileSync(absoluteDefinesPath, "utf8"));
  } catch {
    // JSON parser messages can echo private values from a malformed file.
    errors.push(
      "Provide a readable JSON Dart define file for this release platform",
    );
  }
  errors.push(...validateMobileReleaseValues({ platform, env }));

  const mobileRoot = join(repoRoot, "apps/schoolos_mobile");
  if (platform === "android") {
    if (!isFile(join(mobileRoot, "android/key.properties"))) {
      errors.push(
        "android/key.properties is required; supply the approved application ID and upload keystore",
      );
    }
    // Java Properties parsing and signing key access belong to Gradle's
    // verifySchoolosReleaseConfiguration task, which the CLI runs next.
  } else if (platform === "ios") {
    const identityPath = join(
      mobileRoot,
      "ios/Flutter/ReleaseIdentity.xcconfig",
    );
    try {
      const ios = parseXcconfig(readFileSync(identityPath, "utf8"));
      const bundleId = ios.SCHOOL_OS_IOS_BUNDLE_IDENTIFIER;
      if (
        !hasValue(bundleId) ||
        !/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(bundleId) ||
        isPlaceholder(bundleId)
      ) {
        errors.push(
          "The iOS release bundle identifier must be a registered identifier",
        );
      }
      if (
        !/^[A-Z0-9]{10}$/.test(ios.DEVELOPMENT_TEAM ?? "") ||
        isPlaceholder(ios.DEVELOPMENT_TEAM)
      ) {
        errors.push(
          "iOS DEVELOPMENT_TEAM must be the approved 10-character team ID",
        );
      }
      if (!["Automatic", "Manual"].includes(ios.CODE_SIGN_STYLE)) {
        errors.push("iOS CODE_SIGN_STYLE must be Automatic or Manual");
      }
    } catch {
      errors.push(
        "ios/Flutter/ReleaseIdentity.xcconfig must be readable and contain the approved release identity",
      );
    }
  }

  return { errors, definesPath: absoluteDefinesPath, mobileRoot };
}

export function releaseBuildArgs(platform, definesPath) {
  if (!["android", "ios"].includes(platform) || !definesPath) {
    throw new Error("A platform and validated Dart define file are required");
  }
  return [
    "build",
    platform === "android" ? "appbundle" : "ipa",
    "--release",
    `--dart-define-from-file=${definesPath}`,
  ];
}

export function parseXcconfig(source = "") {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(
      /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*(?:\/\/.*)?$/,
    );
    if (match) values[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return values;
}

function validateProductionApiUrl(errors, value) {
  if (!hasValue(value)) {
    errors.push("SCHOOL_OS_API_BASE_URL is required in the Dart define file");
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname) {
      errors.push("SCHOOL_OS_API_BASE_URL must use HTTPS for production");
    }
    if (url.username || url.password || url.search || url.hash) {
      errors.push(
        "SCHOOL_OS_API_BASE_URL cannot contain credentials, query parameters, or fragments",
      );
    }
    if (url.pathname.replace(/\/+$/, "") !== "/api/v1") {
      errors.push("SCHOOL_OS_API_BASE_URL must use the /api/v1 API prefix");
    }
    if (
      /^(localhost|127\.[0-9.]+|0\.0\.0\.0|\[::1\]|10\.0\.2\.2)$/i.test(
        url.hostname,
      ) ||
      /\.(localhost|test|invalid|example)$/i.test(url.hostname) ||
      /(^|\.)example\.(com|org|net)$/i.test(url.hostname)
    ) {
      errors.push(
        "SCHOOL_OS_API_BASE_URL must identify the deployed API rather than a local or example host",
      );
    }
  } catch {
    errors.push("SCHOOL_OS_API_BASE_URL must be an absolute HTTPS URL");
  }
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlaceholder(value) {
  return (
    typeof value === "string" &&
    /(example|placeholder|replace|\.owner\.|ownerteam|<|>)/i.test(value)
  );
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
