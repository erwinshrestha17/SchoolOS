import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('M12 Learning frontend contracts', () => {
  it('adds dashboard, board, student, and parent Learning routes', () => {
    for (const route of [
      'app/dashboard/learning/page.tsx',
      'app/dashboard/learning/activities/page.tsx',
      'app/dashboard/learning/activities/new/page.tsx',
      'app/dashboard/learning/activities/[activityId]/page.tsx',
      'app/dashboard/learning/sessions/page.tsx',
      'app/dashboard/learning/smart-board/launch/page.tsx',
      'app/dashboard/learning/lab/page.tsx',
      'app/dashboard/learning/progress/page.tsx',
      'app/classroom/board/session/[sessionId]/page.tsx',
      'app/student/learning/join/page.tsx',
      'app/student/learning/session/[sessionId]/page.tsx',
      'app/parent/learning/page.tsx',
      'app/parent/learning/progress/page.tsx',
    ]) {
      assert.equal(existsSync(join(webRoot, route)), true, `Missing ${route}`);
    }
  });

  it('wires Learning through dashboard permissions and module entitlements', () => {
    const layout = read('app/dashboard/layout.tsx');
    const sidebar = read('components/layout/sidebar.tsx');

    assert.match(layout, /prefix:\s*'\/dashboard\/learning'/);
    assert.match(layout, /'learning:read'/);
    assert.match(layout, /'learning:launch'/);
    assert.match(layout, /return 'learning'/);

    assert.match(sidebar, /label:\s*'Learning'/);
    assert.match(sidebar, /href:\s*'\/dashboard\/learning'/);
    assert.match(sidebar, /learningPermissions/);
    assert.match(sidebar, /return 'learning'/);
  });

  it('adds a real Learning API client for the backend MVP endpoints', () => {
    const client = read('lib/api/learning.ts');
    const barrel = read('lib/api/index.ts');

    for (const helper of [
      'listActivities',
      'createActivity',
      'getActivity',
      'updateActivity',
      'archiveActivity',
      'launchSession',
      'listSessions',
      'getSession',
      'pauseSession',
      'heartbeatSession',
      'listParticipants',
      'resumeSession',
      'endSession',
      'joinSession',
      'startAttempt',
      'autosaveAttempt',
      'submitAttempt',
      'getClassProgress',
      'getStudentProgress',
      'getParentSummary',
      'listResources',
      'createResource',
      'getResource',
      'updateResource',
      'archiveResource',
      'listActivityResources',
      'attachActivityResource',
    ]) {
      assert.match(client, new RegExp(`${helper}:`), `Missing ${helper}`);
    }

    for (const endpoint of [
      '/learning/activities',
      '/learning/sessions',
      '/heartbeat',
      '/participants',
      '/learning/resources',
      '/resources',
      '/learning/sessions/join',
      '/learning/attempts/',
      '/learning/progress/class/',
      '/learning/progress/student/',
      '/parent/learning/summary',
    ]) {
      assert.match(client, new RegExp(endpoint.replaceAll('/', '\\/')));
    }

    assert.match(client, /LearningActivityStatus[\s\S]*'READY'/);
    assert.match(client, /LearningQuestionType[\s\S]*'MATCHING'/);
    assert.match(client, /LearningQuestionType[\s\S]*'ORDERING'/);
    assert.match(client, /LearningResourceStatus[\s\S]*'ARCHIVED'/);
    assert.doesNotMatch(client, /PUBLISHED/);
    assert.match(barrel, /export \* from '\.\/learning'/);
  });

  it('uses real Learning APIs and production states in the workspaces', () => {
    const workspace = read('components/learning/learning-workspace.tsx');
    const runtime = read('components/learning/learning-runtime.tsx');
    const sessions = read('components/learning/learning-sessions-panel.tsx');
    const resources = read('components/learning/learning-resources-panel.tsx');

    for (const apiCall of [
      'learningApi.listActivities',
      'learningApi.createActivity',
      'learningApi.updateActivity',
      'learningApi.archiveActivity',
      'learningApi.getClassProgress',
      'learningApi.getStudentProgress',
    ]) {
      assert.match(workspace, new RegExp(apiCall.replace('.', '\\.')));
    }

    for (const apiCall of [
      'learningApi.joinSession',
      'learningApi.startAttempt',
      'learningApi.autosaveAttempt',
      'learningApi.submitAttempt',
      'learningApi.getParentSummary',
      'learningApi.heartbeatSession',
    ]) {
      assert.match(runtime, new RegExp(apiCall.replace('.', '\\.')));
    }

    for (const apiCall of [
      'learningApi.listSessions',
      'learningApi.launchSession',
      'learningApi.pauseSession',
      'learningApi.resumeSession',
      'learningApi.endSession',
      'learningApi.heartbeatSession',
      'learningApi.listParticipants',
    ]) {
      assert.match(sessions, new RegExp(apiCall.replace('.', '\\.')));
    }

    for (const apiCall of [
      'learningApi.listActivityResources',
      'learningApi.attachActivityResource',
      'learningApi.archiveResource',
    ]) {
      assert.match(resources, new RegExp(apiCall.replace('.', '\\.')));
    }

    assert.match(workspace, /EmptyState/);
    assert.match(workspace, /LoadingState/);
    assert.match(runtime, /PermissionDenied/);
    assert.match(runtime, /module\.learning/);
    assert.match(workspace, /MATCHING/);
    assert.match(workspace, /ORDERING/);
    assert.match(runtime, /Confirm submit/);
    assert.match(runtime, /heartbeat/i);
    assert.doesNotMatch(workspace, /mockLearning|fakeLearning|placeholderData/);
    assert.doesNotMatch(runtime, /mockLearning|fakeLearning|placeholderData/);
  });

  it('keeps parent and student Learning views non-comparative and answer-safe', () => {
    const runtime = read('components/learning/learning-runtime.tsx');
    const sessions = read('components/learning/learning-sessions-panel.tsx');

    assert.match(runtime, /Child/);
    assert.match(runtime, /supportiveLabel/);
    assert.match(runtime, /Recent completed activities/);
    assert.doesNotMatch(runtime, /leaderboard|ranking|rank/i);
    assert.doesNotMatch(runtime, /correctAnswer/);
    assert.doesNotMatch(sessions, /learningApi\.listAnswers|correctAnswer/);
  });
});
