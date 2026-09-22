// Browser specs share one loopback IP and the real five-attempts/minute
// credential limit. Pace deliberate sign-ins without disabling throttling,
// changing server responses, or retrying failed credentials. Each new worker
// waits one slot too, so a test failure/restart cannot create another burst.
let nextAttemptAt = Date.now() + 13_000;

export async function paceCredentialAttempt() {
  const admittedAt = Math.max(Date.now(), nextAttemptAt);
  nextAttemptAt = admittedAt + 13_000;
  await new Promise((resolve) => setTimeout(resolve, admittedAt - Date.now()));
}
