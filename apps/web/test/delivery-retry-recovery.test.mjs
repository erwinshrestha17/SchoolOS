import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL(
    "../components/notifications/delivery-operations-workspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Exercise the actual component's event handlers and rendered element props.
// Hooks and API transport are controlled here; this is not browser or provider proof.
function harness({ result = "FAILED", reject = false, support = false } = {}) {
  const states = [];
  let cursor = 0;
  let options;
  const calls = [];
  const invalidated = [];
  const failures = {
    data: {
      page: 1,
      limit: 25,
      total: 1,
      items: [
        {
          id: "delivery-test",
          status: "FAILED",
          channel: "EMAIL",
          retryStatus: "retryable",
          retryCount: 1,
          failedAt: null,
          recipientSummary: { destinationMasked: "s***@example.test" },
        },
      ],
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: async () => {},
  };
  const mutation = {
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    reset() {
      this.isError = false;
      this.isSuccess = false;
      this.data = undefined;
    },
    mutate(variables) {
      this.isPending = true;
      this.isError = false;
      this.isSuccess = false;
      this.finished = (async () => {
        try {
          this.data = await options.mutationFn(variables);
          this.isSuccess = true;
          await options.onSuccess?.(this.data, variables);
        } catch {
          this.isError = true;
        } finally {
          await options.onSettled?.();
          this.isPending = false;
        }
      })();
    },
  };
  const components = new Proxy({}, { get: (_, key) => key });
  const exports = {};
  runInNewContext(compiled, {
    exports,
    URLSearchParams,
    require(id) {
      if (id === "react/jsx-runtime") return require(id);
      if (id === "react")
        return {
          useState(initial) {
            const index = cursor++;
            if (!(index in states)) states[index] = initial;
            return [
              states[index],
              (value) => {
                states[index] =
                  typeof value === "function" ? value(states[index]) : value;
              },
            ];
          },
        };
      if (id === "@tanstack/react-query")
        return {
          useQuery({ queryKey }) {
            return queryKey[0] === "notification-delivery-failures"
              ? failures
              : { data: { overallMode: "disabled" } };
          },
          useQueryClient: () => ({
            invalidateQueries: async ({ queryKey }) => {
              invalidated.push(queryKey[0]);
            },
          }),
          useMutation(value) {
            options = value;
            return mutation;
          },
        };
      if (id === "@/components/session-provider")
        return {
          useSession: () => ({
            session: { user: { isSupportOverride: support } },
            hasPermissions: () => true,
          }),
        };
      if (id === "@/lib/api/communications")
        return {
          communicationsApi: {
            async retryNotificationDelivery(deliveryId, body) {
              calls.push({ deliveryId, reason: body.reason });
              if (reject) throw new Error("Simulated acknowledgement loss");
              return {
                deliveryId,
                status: result,
                errorMessage:
                  result === "RETRY_PENDING"
                    ? "Queue handoff could not be confirmed."
                    : null,
                retriedAt: "2026-09-12T00:00:00Z",
              };
            },
          },
        };
      if (id === "@schoolos/core")
        return { formatBsDateTime: () => "test date" };
      if (id === "next/navigation")
        return {
          useRouter: () => ({ replace() {} }),
          usePathname: () => "/dashboard/notifications/failures",
          useSearchParams: () => new URLSearchParams(),
        };
      if (id === "next/link") return { default: "Link" };
      return components;
    },
  });
  const render = () => {
    cursor = 0;
    return exports.DeliveryOperationsWorkspace({ initialView: "failures" });
  };
  const dialog = () =>
    nodes(render()).find((node) => node.type === "ConfirmDialog");
  const open = () => {
    nodes(render())
      .find((node) => node.type === "button" && text(node).trim() === "Retry")
      .props.onClick();
    nodes(dialog())
      .find((node) => node.type === "textarea")
      .props.onChange({ target: { value: "Verified provider recovery" } });
  };
  const submit = async () => {
    dialog().props.onConfirm();
    await mutation.finished;
  };
  return {
    render,
    dialog,
    open,
    submit,
    mutation,
    failures,
    calls,
    invalidated,
  };
}

function nodes(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}

function text(value) {
  if (value === null || value === undefined || typeof value === "boolean")
    return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(text).join(" ");
  return text(value.props?.children);
}

test("returned FAILED keeps reason and review open rather than implying successful retry", async () => {
  const ui = harness();
  ui.open();
  await ui.submit();
  assert.equal(ui.dialog().props.isOpen, true);
  assert.equal(ui.dialog().props.confirmDisabled, true);
  assert.match(text(ui.dialog()), /still failed and needs review/);
  assert.equal(
    nodes(ui.dialog()).find((node) => node.type === "textarea").props.value,
    "Verified provider recovery",
  );
  assert.deepEqual(ui.calls, [
    { deliveryId: "delivery-test", reason: "Verified provider recovery" },
  ]);
  assert.deepEqual(ui.invalidated, [
    "notification-deliveries",
    "notification-delivery-failures",
  ]);
  await ui.submit();
  assert.equal(
    ui.calls.length,
    1,
    "completed result cannot silently issue another retry",
  );
});

test("pending with a diagnostic does not claim queue acceptance or provider delivery", async () => {
  const ui = harness({ result: "RETRY_PENDING" });
  ui.open();
  await ui.submit();
  assert.match(text(ui.dialog()), /queue handoff or processing needs review/);
  assert.match(
    text(ui.dialog()),
    /Do not assume this retry reached the provider/,
  );
  assert.equal(ui.dialog().props.confirmDisabled, true);
});

test("uncertain network outcome refreshes state, preserves reason, and does not resend", async () => {
  const ui = harness({ reject: true });
  ui.open();
  await ui.submit();
  assert.match(text(ui.dialog()), /delivery may already have changed/);
  assert.doesNotMatch(text(ui.dialog()), /No delivery status was changed/);
  assert.equal(
    nodes(ui.dialog()).find((node) => node.type === "textarea").props.value,
    "Verified provider recovery",
  );
  assert.deepEqual(ui.invalidated, [
    "notification-deliveries",
    "notification-delivery-failures",
  ]);
  assert.equal(ui.calls.length, 1);
  ui.failures.isError = true;
  assert.equal(ui.dialog().props.confirmDisabled, true);
  assert.match(text(ui.dialog()), /eligibility is unavailable/);
  await ui.submit();
  assert.equal(ui.calls.length, 1);
});

test("changed eligibility and a refresh in progress both block another retry", async () => {
  const ui = harness({ reject: true });
  ui.open();
  await ui.submit();
  ui.failures.isFetching = true;
  assert.equal(ui.dialog().props.confirmDisabled, true);
  ui.failures.isFetching = false;
  ui.failures.data.items[0].retryStatus = "pending";
  assert.equal(ui.dialog().props.confirmDisabled, true);
  await ui.submit();
  assert.equal(ui.calls.length, 1);
});

test("support diagnostics never exposes a retry even if permission alias is present", () => {
  const ui = harness({ support: true });
  assert.equal(
    nodes(ui.render()).filter(
      (node) => node.type === "button" && text(node).trim() === "Retry",
    ).length,
    0,
  );
  assert.equal(ui.dialog().props.confirmDisabled, true);
});

test("Sent and unexpected returned status never imply recipient delivery", async () => {
  for (const [result, expected] of [
    ["SENT", /not confirmation that the recipient received or read it/],
    ["FUTURE_STATUS", /did not confirm a recognized delivery outcome/],
    ["CANCELLED", /delivery is cancelled/],
    ["SKIPPED", /delivery was skipped/],
  ]) {
    const ui = harness({ result });
    ui.open();
    await ui.submit();
    assert.match(text(ui.dialog()), expected);
    assert.equal(ui.dialog().props.confirmDisabled, true);
  }
});
