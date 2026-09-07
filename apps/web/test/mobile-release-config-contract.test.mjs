import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  inspectMobileReleaseConfig,
  parseXcconfig,
  releaseBuildArgs,
  validateMobileReleaseValues,
} from "../../../scripts/lib/mobile-release-config.mjs";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const validEnvironment = {
  SCHOOL_OS_ENV: "production",
  SCHOOL_OS_API_BASE_URL: "https://api.schoolos.com.np/api/v1",
  SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  SCHOOL_OS_FIREBASE_PROJECT_ID: "schoolos-production",
  SCHOOL_OS_FIREBASE_API_KEY: "synthetic-public-client-key",
  SCHOOL_OS_FIREBASE_APP_ID: "1:123456789:android:abcdef",
};

function errorsFor(overrides = {}, platform = "android") {
  return validateMobileReleaseValues({
    platform,
    env: { ...validEnvironment, ...overrides },
  });
}

describe("mobile production release configuration", () => {
  it("checks the exact keys consumed by Flutter, separately for each platform", () => {
    assert.deepEqual(errorsFor(), []);
    assert.deepEqual(
      errorsFor(
        {
          SCHOOL_OS_FIREBASE_APP_ID: "1:123456789:ios:abcdef",
        },
        "ios",
      ),
      [],
    );
    assert.ok(
      errorsFor({}, "ios").some((error) => error.includes("ios Firebase app")),
    );
    assert.ok(
      errorsFor({
        SCHOOL_OS_FIREBASE_APP_ID: "1:987654321:android:abcdef",
      }).some((error) => error.includes("same project number")),
    );
  });

  it("rejects development defaults, missing Firebase, typos, and embedded backend secrets", () => {
    assert.ok(errorsFor({ SCHOOL_OS_ENV: "development" }).length);
    for (const key of Object.keys(validEnvironment).filter((key) =>
      key.includes("FIREBASE"),
    )) {
      assert.ok(errorsFor({ [key]: "" }).length, key);
    }
    const errors = errorsFor({
      SCHOOL_OS_FIREBASE_ANDROID_APP_ID:
        validEnvironment.SCHOOL_OS_FIREBASE_APP_ID,
      JWT_SECRET: "private-value-that-must-not-appear",
    });
    assert.ok(errors.some((error) => error.includes("unsupported keys")));
    assert.ok(!errors.join(" ").includes("private-value-that-must-not-appear"));
    assert.ok(
      errorsFor({ SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID: 123 }).length,
    );
    assert.ok(
      validateMobileReleaseValues({ platform: "android", env: null }).length,
    );
    assert.ok(
      validateMobileReleaseValues({ platform: "android", env: [] }).length,
    );
    assert.ok(errorsFor({}, "unknown").length);
  });

  it("rejects local, insecure, credential-bearing, and incorrectly prefixed API URLs", () => {
    for (const url of [
      "http://api.schoolos.com.np/api/v1",
      "https://localhost/api/v1",
      "https://127.0.0.1/api/v1",
      "https://[::1]/api/v1",
      "https://10.0.2.2/api/v1",
      "https://api.example.com/api/v1",
      "https://school.test/api/v1",
      "https://api.schoolos.com.np/wrong/api/v1",
      "https://secret:password@api.schoolos.com.np/api/v1",
      "https://api.schoolos.com.np/api/v1?token=private",
      "https://api.schoolos.com.np/api/v1#fragment",
      "invalid",
    ]) {
      const errors = errorsFor({ SCHOOL_OS_API_BASE_URL: url });
      assert.ok(errors.length > 0, url);
      assert.ok(!errors.join(" ").includes(url));
    }
  });

  it("binds release commands to the validated file and appropriate store artifact", () => {
    const path = "/tmp/SchoolOS release/defines.json";
    assert.deepEqual(releaseBuildArgs("android", path), [
      "build",
      "appbundle",
      "--release",
      `--dart-define-from-file=${path}`,
    ]);
    assert.deepEqual(releaseBuildArgs("ios", path), [
      "build",
      "ipa",
      "--release",
      `--dart-define-from-file=${path}`,
    ]);
    assert.throws(() => releaseBuildArgs("other", path));
  });

  it("reads only supplied files and reports malformed input without private values", (t) => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "schoolos-mobile-release-"));
    t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
    const configPath = join(fixtureRoot, "defines.json");
    const androidKeys = join(
      fixtureRoot,
      "apps/schoolos_mobile/android/key.properties",
    );
    mkdirSync(dirname(androidKeys), { recursive: true });
    writeFileSync(androidKeys, "applicationId=synthetic.fixture\n");
    writeFileSync(configPath, JSON.stringify(validEnvironment));
    assert.deepEqual(
      inspectMobileReleaseConfig({
        repoRoot: fixtureRoot,
        platform: "android",
        definesPath: configPath,
      }).errors,
      [],
    );
    // Native signing verification runs separately in Gradle; file presence is
    // deliberately not treated as proof that this synthetic keystore is valid.
    writeFileSync(configPath, '{"SCHOOL_OS_ENV":"private-broken-json');
    const result = inspectMobileReleaseConfig({
      repoRoot: fixtureRoot,
      platform: "android",
      definesPath: configPath,
    });
    assert.ok(result.errors.some((error) => error.includes("readable JSON")));
    assert.ok(!result.errors.join(" ").includes("private-broken-json"));
    assert.ok(
      inspectMobileReleaseConfig({
        repoRoot: fixtureRoot,
        platform: "android",
        definesPath: fixtureRoot,
      }).errors.some((error) => error.includes("readable JSON")),
    );
  });

  it("parses iOS identity comments and rejects copied example identities", (t) => {
    assert.deepEqual(
      parseXcconfig(
        'DEVELOPMENT_TEAM = "A1B2C3D4E5" // release owner\nCODE_SIGN_STYLE = Automatic\n',
      ),
      { DEVELOPMENT_TEAM: "A1B2C3D4E5", CODE_SIGN_STYLE: "Automatic" },
    );
    const fixtureRoot = mkdtempSync(join(tmpdir(), "schoolos-ios-release-"));
    t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
    const configPath = join(fixtureRoot, "defines.json");
    const identity = join(
      fixtureRoot,
      "apps/schoolos_mobile/ios/Flutter/ReleaseIdentity.xcconfig",
    );
    mkdirSync(dirname(identity), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify({
        ...validEnvironment,
        SCHOOL_OS_FIREBASE_APP_ID: "1:123456789:ios:abcdef",
      }),
    );
    writeFileSync(
      identity,
      readFileSync(
        join(
          repoRoot,
          "apps/schoolos_mobile/ios/Flutter/ReleaseIdentity.xcconfig.example",
        ),
      ),
    );
    assert.ok(
      inspectMobileReleaseConfig({
        repoRoot: fixtureRoot,
        platform: "ios",
        definesPath: configPath,
      }).errors.length > 0,
    );
    writeFileSync(
      identity,
      [
        "SCHOOL_OS_IOS_BUNDLE_IDENTIFIER = np.schoolos.mobile",
        "DEVELOPMENT_TEAM = A1B2C3D4E5",
        "CODE_SIGN_STYLE = Automatic",
      ].join("\n"),
    );
    assert.deepEqual(
      inspectMobileReleaseConfig({
        repoRoot: fixtureRoot,
        platform: "ios",
        definesPath: configPath,
      }).errors,
      [],
    );
  });

  it("CLI fails without config and rejects override arguments before starting a build", () => {
    for (const args of [
      [],
      ["android", "/missing-config.json"],
      [
        "android",
        "/missing-config.json",
        "--build",
        "--dart-define=SCHOOL_OS_ENV=development",
      ],
    ]) {
      const result = spawnSync(
        process.execPath,
        [join(repoRoot, "scripts/check-mobile-release-config.mjs"), ...args],
        { encoding: "utf8" },
      );
      assert.equal(result.status, 1);
      assert.doesNotMatch(result.stdout, /preflight passed/);
      assert.doesNotMatch(result.stderr, /Error:| at file:/);
    }
  });
});
