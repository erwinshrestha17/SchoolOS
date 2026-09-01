import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  parseProperties,
  parseXcconfig,
  validateMobileReleaseValues,
} from '../../../scripts/lib/mobile-release-config.mjs';

const repoRoot = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, repoRoot), 'utf8');

const validAndroid = {
  applicationId: 'np.schoolos.mobile',
  storeFile: 'upload-keystore.jks',
  storePassword: 'store-secret',
  keyAlias: 'upload',
  keyPassword: 'key-secret',
};
const validIos = {
  SCHOOL_OS_IOS_BUNDLE_IDENTIFIER: 'np.schoolos.mobile',
  DEVELOPMENT_TEAM: 'A1B2C3D4E5',
  CODE_SIGN_STYLE: 'Automatic',
};
const validEnvironment = {
  SCHOOL_OS_ENV: 'production',
  SCHOOL_OS_API_BASE_URL: 'https://api.schoolos.example.np/api/v1',
  SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  SCHOOL_OS_FIREBASE_PROJECT_ID: 'schoolos-production',
  SCHOOL_OS_FIREBASE_ANDROID_API_KEY: 'android-api-key',
  SCHOOL_OS_FIREBASE_ANDROID_APP_ID: '1:123456789:android:abcdef',
  SCHOOL_OS_FIREBASE_IOS_API_KEY: 'ios-api-key',
  SCHOOL_OS_FIREBASE_IOS_APP_ID: '1:123456789:ios:abcdef',
};

describe('mobile production release configuration', () => {
  it('parses ignored Android and iOS identity files without exposing them to source', () => {
    assert.deepEqual(
      parseProperties('applicationId=np.schoolos.mobile\nkeyAlias=upload\n'),
      { applicationId: 'np.schoolos.mobile', keyAlias: 'upload' },
    );
    assert.deepEqual(
      parseXcconfig(
        'SCHOOL_OS_IOS_BUNDLE_IDENTIFIER = np.schoolos.mobile\nDEVELOPMENT_TEAM = A1B2C3D4E5\n',
      ),
      {
        SCHOOL_OS_IOS_BUNDLE_IDENTIFIER: 'np.schoolos.mobile',
        DEVELOPMENT_TEAM: 'A1B2C3D4E5',
      },
    );
  });

  it('accepts a complete production identity, signing, HTTPS, and Firebase configuration', () => {
    assert.deepEqual(
      validateMobileReleaseValues({
        android: validAndroid,
        ios: validIos,
        env: validEnvironment,
        androidStoreFileExists: true,
      }),
      [],
    );
  });

  it('rejects example identities, missing signing material, HTTP, and cross-platform Firebase IDs', () => {
    const errors = validateMobileReleaseValues({
      android: { applicationId: 'com.example.schoolos_mobile' },
      ios: {
        SCHOOL_OS_IOS_BUNDLE_IDENTIFIER: 'com.example.schoolosMobile',
        DEVELOPMENT_TEAM: 'OWNERTEAM1',
        CODE_SIGN_STYLE: 'Unknown',
      },
      env: {
        ...validEnvironment,
        SCHOOL_OS_ENV: 'staging',
        SCHOOL_OS_API_BASE_URL: 'http://schoolos.test/api',
        SCHOOL_OS_FIREBASE_ANDROID_APP_ID: '1:123456789:ios:abcdef',
      },
      androidStoreFileExists: false,
    });

    assert.ok(errors.some((error) => error.includes('owner-approved reverse-DNS')));
    assert.ok(errors.some((error) => error.includes('storePassword is required')));
    assert.ok(errors.some((error) => error.includes('existing keystore')));
    assert.ok(errors.some((error) => error.includes('10-character team ID')));
    assert.ok(errors.some((error) => error.includes('CODE_SIGN_STYLE')));
    assert.ok(errors.some((error) => error.includes('SCHOOL_OS_ENV')));
    assert.ok(errors.some((error) => error.includes('must use HTTPS')));
    assert.ok(errors.some((error) => error.includes('must include the /api/v1')));
    assert.ok(errors.some((error) => error.includes('android Firebase app')));
  });

  it('keeps release builds fail-closed and never debug-signed', () => {
    const gradle = read('apps/schoolos_mobile/android/app/build.gradle.kts');
    const iosRelease = read('apps/schoolos_mobile/ios/Flutter/Release.xcconfig');
    const iosProject = read(
      'apps/schoolos_mobile/ios/Runner.xcodeproj/project.pbxproj',
    );

    assert.match(gradle, /releaseBuildRequested/);
    assert.match(gradle, /rootProject\.file\("key\.properties"\)/);
    assert.doesNotMatch(
      gradle,
      /signingConfig\s*=\s*signingConfigs\.getByName\("debug"\)/,
    );
    assert.match(iosRelease, /#include\? "ReleaseIdentity\.xcconfig"/);
    assert.match(iosProject, /\$\(SCHOOL_OS_IOS_BUNDLE_IDENTIFIER\)/);
  });
});
