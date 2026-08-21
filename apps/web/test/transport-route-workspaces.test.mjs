import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

test("Transport route pages are the authoritative workspace state", () => {
  const workspace = read("components/transport/transport-workspace.tsx");
  const routePages = {
    overview: read("app/dashboard/transport/page.tsx"),
    routes: read("app/dashboard/transport/routes/page.tsx"),
    vehicles: read("app/dashboard/transport/vehicles/page.tsx"),
    assignments: read("app/dashboard/transport/assignments/page.tsx"),
    trips: read("app/dashboard/transport/trips/page.tsx"),
    location: read("app/dashboard/transport/location/page.tsx"),
    reports: read("app/dashboard/transport/reports/page.tsx"),
  };

  assert.match(workspace, /const activeTab = workspace/);
  assert.doesNotMatch(workspace, /setActiveTab|useState<TransportTab>/);

  for (const [name, source] of Object.entries(routePages)) {
    assert.match(
      source,
      new RegExp(`workspace=["']${name}["']`),
      `${name} route must select its matching workspace`,
    );
  }

  for (const href of [
    "/dashboard/transport/routes",
    "/dashboard/transport/vehicles",
    "/dashboard/transport/assignments",
    "/dashboard/transport/trips",
    "/dashboard/transport/location",
  ]) {
    assert.match(workspace, new RegExp(`href=["']${href}["']`));
  }
});

test("Transport compatibility routes redirect to the canonical workspaces", () => {
  const students = read("app/dashboard/transport/students/page.tsx");
  const liveStatus = read("app/dashboard/transport/live-status/page.tsx");

  assert.match(students, /redirect\(["']\/dashboard\/transport\/assignments["']\)/);
  assert.match(liveStatus, /redirect\(["']\/dashboard\/transport\/location["']\)/);
});

test("Transport uses bounded remote people selectors and route-scoped queries", () => {
  const workspace = read("components/transport/transport-workspace.tsx");

  assert.match(workspace, /RemoteStudentSelector/);
  assert.match(workspace, /RemoteStaffSelector/);
  assert.doesNotMatch(workspace, /listStudents\s*\(|listStaff\s*\(|limit:\s*1000/);
  assert.match(workspace, /enabled: isWorkspace\(/);
  assert.match(workspace, /enabled: activeTab === "reports"/);
  assert.match(
    workspace,
    /enabled: activeTab === "location" && Boolean\(selectedTripId\)/,
  );
  assert.match(
    workspace,
    /const firstError = workspaceErrors\[activeTab\]\.find\(Boolean\)/,
  );
});

test("Transport keeps point-in-time location truth without staff-facing backlog copy", () => {
  const workspace = read("components/transport/transport-workspace.tsx");

  assert.match(workspace, /transport-location-freshness-panel/);
  assert.match(workspace, /not a live map/);
  assert.match(workspace, /Confirm with the driver/);
  assert.match(workspace, /Treat the trip position as approximate/);

  for (const diagnostic of [
    /Remaining Issues/,
    /needs summary API/,
    /WebSocket/,
    /staging provider data/,
    /Map Preview Deferred/,
    /Redis latest/,
    /API smoke testing/,
  ]) {
    assert.doesNotMatch(workspace, diagnostic);
  }
});
