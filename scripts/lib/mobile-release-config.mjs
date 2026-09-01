import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

const androidPropertyNames = [
  'applicationId',
  'storeFile',
  'storePassword',
  'keyAlias',
  'keyPassword',
];

const firebaseCommonNames = [
  'SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID',
  'SCHOOL_OS_FIREBASE_PROJECT_ID',
];

export function parseProperties(source = '') {
  return parseAssignments(source, /^[ \t]*([^#!\s][^=:\s]*)[ \t]*[=:][ \t]*(.*)$/);
}

export function parseXcconfig(source = '') {
  return parseAssignments(source, /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$/);
}

function parseAssignments(source, pattern) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(pattern);
    if (!match) continue;
    values[match[1]] = match[2].trim();
  }
  return values;
}

export function validateMobileReleaseValues({
  android = {},
  ios = {},
  env = {},
  androidStoreFileExists = false,
}) {
  const errors = [];

  for (const name of androidPropertyNames) {
    requireValue(errors, android, name, 'android/key.properties');
  }
  if (
    hasValue(android.applicationId) &&
    (!isReverseDnsIdentifier(android.applicationId) ||
      isPlaceholder(android.applicationId))
  ) {
    errors.push(
      'android/key.properties applicationId must be an owner-approved reverse-DNS identifier',
    );
  }
  if (hasValue(android.storeFile) && !androidStoreFileExists) {
    errors.push('android/key.properties storeFile must resolve to an existing keystore');
  }

  requireValue(
    errors,
    ios,
    'SCHOOL_OS_IOS_BUNDLE_IDENTIFIER',
    'ios/Flutter/ReleaseIdentity.xcconfig',
  );
  requireValue(
    errors,
    ios,
    'DEVELOPMENT_TEAM',
    'ios/Flutter/ReleaseIdentity.xcconfig',
  );
  requireValue(
    errors,
    ios,
    'CODE_SIGN_STYLE',
    'ios/Flutter/ReleaseIdentity.xcconfig',
  );
  if (
    hasValue(ios.SCHOOL_OS_IOS_BUNDLE_IDENTIFIER) &&
    (!isReverseDnsIdentifier(ios.SCHOOL_OS_IOS_BUNDLE_IDENTIFIER) ||
      isPlaceholder(ios.SCHOOL_OS_IOS_BUNDLE_IDENTIFIER))
  ) {
    errors.push(
      'iOS release bundle identifier must be an owner-approved reverse-DNS identifier',
    );
  }
  if (
    hasValue(ios.DEVELOPMENT_TEAM) &&
    (!/^[A-Z0-9]{10}$/.test(ios.DEVELOPMENT_TEAM) ||
      isPlaceholder(ios.DEVELOPMENT_TEAM))
  ) {
    errors.push('iOS DEVELOPMENT_TEAM must be the owner-approved 10-character team ID');
  }
  if (
    hasValue(ios.CODE_SIGN_STYLE) &&
    !['Automatic', 'Manual'].includes(ios.CODE_SIGN_STYLE)
  ) {
    errors.push('iOS CODE_SIGN_STYLE must be Automatic or Manual');
  }

  if (env.SCHOOL_OS_ENV !== 'production') {
    errors.push('SCHOOL_OS_ENV must be production');
  }
  validateProductionApiUrl(errors, env.SCHOOL_OS_API_BASE_URL);

  for (const name of firebaseCommonNames) {
    requireValue(errors, env, name, 'mobile release environment');
  }
  for (const platform of ['ANDROID', 'IOS']) {
    requireValue(
      errors,
      env,
      `SCHOOL_OS_FIREBASE_${platform}_API_KEY`,
      'mobile release environment',
    );
    const appIdName = `SCHOOL_OS_FIREBASE_${platform}_APP_ID`;
    requireValue(errors, env, appIdName, 'mobile release environment');
    const appId = env[appIdName];
    if (
      hasValue(appId) &&
      !appId.toLowerCase().includes(`:${platform.toLowerCase()}:`)
    ) {
      errors.push(`${appIdName} must identify the ${platform.toLowerCase()} Firebase app`);
    }
  }

  return errors;
}

export function inspectMobileReleaseConfig({ repoRoot, env = process.env }) {
  const mobileRoot = join(repoRoot, 'apps/schoolos_mobile');
  const androidRoot = join(mobileRoot, 'android');
  const androidBuildPath = join(androidRoot, 'app/build.gradle.kts');
  const androidPropertiesPath = join(androidRoot, 'key.properties');
  const iosReleaseConfigPath = join(mobileRoot, 'ios/Flutter/Release.xcconfig');
  const iosIdentityPath = join(
    mobileRoot,
    'ios/Flutter/ReleaseIdentity.xcconfig',
  );
  const iosProjectPath = join(
    mobileRoot,
    'ios/Runner.xcodeproj/project.pbxproj',
  );
  const errors = [];

  const androidBuild = readOptional(androidBuildPath);
  const iosReleaseConfig = readOptional(iosReleaseConfigPath);
  const iosProject = readOptional(iosProjectPath);
  if (!androidBuild) {
    errors.push('Android release build configuration is missing');
  } else {
    if (/signingConfig\s*=\s*signingConfigs\.getByName\(["']debug["']\)/.test(androidBuild)) {
      errors.push('Android release builds must never use the debug signing config');
    }
    if (!androidBuild.includes('releaseBuildRequested')) {
      errors.push('Android release builds must fail closed when release identity is missing');
    }
  }
  if (!iosReleaseConfig?.includes('#include? "ReleaseIdentity.xcconfig"')) {
    errors.push('iOS Release.xcconfig must include the untracked release identity');
  }
  if (!iosProject?.includes('$(SCHOOL_OS_IOS_BUNDLE_IDENTIFIER)')) {
    errors.push('iOS Runner bundle identity must come from the release xcconfig');
  }

  const android = parseProperties(readOptional(androidPropertiesPath));
  const ios = parseXcconfig(readOptional(iosIdentityPath));
  const storeFile = android.storeFile;
  const storePath = hasValue(storeFile)
    ? isAbsolute(storeFile)
      ? storeFile
      : resolve(androidRoot, storeFile)
    : '';

  errors.push(
    ...validateMobileReleaseValues({
      android,
      ios,
      env,
      androidStoreFileExists: hasValue(storePath) && existsSync(storePath),
    }),
  );

  return errors;
}

function readOptional(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function requireValue(errors, source, name, location) {
  if (!hasValue(source[name])) {
    errors.push(`${name} is required in ${location}`);
  }
}

function validateProductionApiUrl(errors, value) {
  if (!hasValue(value)) {
    errors.push('SCHOOL_OS_API_BASE_URL is required in mobile release environment');
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      errors.push('SCHOOL_OS_API_BASE_URL must use HTTPS for production');
    }
    if (!url.pathname.replace(/\/+$/, '').endsWith('/api/v1')) {
      errors.push('SCHOOL_OS_API_BASE_URL must include the /api/v1 API prefix');
    }
  } catch {
    errors.push('SCHOOL_OS_API_BASE_URL must be an absolute HTTPS URL');
  }
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isReverseDnsIdentifier(value) {
  return /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(value);
}

function isPlaceholder(value) {
  return /(example|placeholder|replace|your[-_.]?|\.owner\.|ownerteam)/i.test(value);
}
