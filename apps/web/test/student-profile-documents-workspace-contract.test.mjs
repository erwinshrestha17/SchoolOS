import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(webRoot, path), "utf8");

describe("M1 student profile document workspace", () => {
  const workspace = read(
    "components/students/profile/tabs/documents-tab.tsx",
  );
  const studentDetail = read("components/students/student-detail-page.tsx");

  it("replaces the two independent tall columns with one full-width workspace", () => {
    assert.doesNotMatch(workspace, /System Generated Docs/);
    assert.doesNotMatch(workspace, /Uploaded Documents/);
    assert.doesNotMatch(workspace, /lg:grid-cols-2/);
    assert.match(workspace, /title="Documents"/);
    assert.match(
      workspace,
      /Review required files and manage protected student records\./,
    );
  });

  it("renders keyboard-accessible internal document tabs", () => {
    assert.match(workspace, /Document workspace sections/);
    for (const label of [
      "Checklist",
      "All files",
      "School-issued",
      "Requests",
      "Activity",
    ]) {
      assert.match(workspace, new RegExp(`label: '${label}'`));
    }
    assert.match(workspace, /components\/ui\/primitives\/tabs/);
  });

  it("keeps missing, awaiting-review, verified, and unavailable states honest", () => {
    assert.match(workspace, /Missing requirements cannot be assessed here/);
    assert.match(workspace, /return 'Awaiting review'/);
    assert.match(workspace, /status === 'VERIFIED'/);
    assert.match(workspace, /Official checklist totals are not included/);
    assert.match(workspace, /Checklist unavailable/);
    assert.doesNotMatch(workspace, /const requiredDocuments/);
    assert.doesNotMatch(workspace, /buildDocumentChecklist/);
  });

  it("keeps one primary action and secondary actions in overflow menus", () => {
    assert.match(workspace, /Upload document/);
    assert.match(workspace, /moreActionItems/);
    assert.match(workspace, /label: 'View activity'/);
    assert.match(workspace, /More actions for/);
    assert.match(workspace, /label: 'Replace'/);
    assert.match(workspace, /label: 'Archive'/);
    assert.doesNotMatch(workspace, /Request missing documents/);
    assert.doesNotMatch(workspace, /Download checklist/);
  });

  it("rechecks protected file access and uses the shared blob helpers", () => {
    assert.match(
      workspace,
      /api\.previewStudentDocument\(studentId, document\.id\)/,
    );
    assert.match(
      workspace,
      /api\.downloadStudentDocument\(studentId, document\.id\)/,
    );
    assert.match(workspace, /openProtectedFile\(access\.fileAssetId/);
    assert.match(workspace, /downloadProtectedFile\(/);
    assert.doesNotMatch(workspace, /window\.open/);
    assert.doesNotMatch(workspace, /objectKey|publicUrl|access\.url/);
    assert.doesNotMatch(workspace, /document\.(uploadedById|verifiedById) \?\?/);
    assert.match(
      studentDetail,
      /The school-issued document could not be generated\. Please try again\./,
    );
    assert.doesNotMatch(studentDetail, /setPdfError\([\s\S]{0,80}err\.message/);
  });

  it("fails closed for permissions and module-locked activity", () => {
    assert.match(workspace, /hasPermissions\(\['student_documents:manage'\]\)/);
    assert.match(
      workspace,
      /You do not have permission to view document requests/,
    );
    assert.match(workspace, /ModuleLockedState/);
    assert.match(workspace, /isModuleLockedError\(error\)/);
  });

  it("groups confirmed school-issued versions under one document-type row", () => {
    assert.match(workspace, /schoolIssuedTypes\.map/);
    assert.match(
      workspace,
      /generatedDocuments[\s\S]*\.filter\(\(document\) => document\.kind === kind\)/,
    );
    assert.match(workspace, /Version history \(\{versions\.length\}\)/);
    assert.match(workspace, /right\.version - left\.version/);
    assert.doesNotMatch(workspace, /documents\.find\(\(item\) => item\.kind/);
  });

  it("uses a desktop detail rail and a focus-trapped narrow-width sheet", () => {
    assert.match(workspace, /Selected document details/);
    assert.match(workspace, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
    assert.match(workspace, /<Sheet open=\{isDetailDrawerOpen\}/);
    assert.match(workspace, /Selected-document activity/);
    assert.match(workspace, /aria-label="Close selected document details"/);
  });
});
