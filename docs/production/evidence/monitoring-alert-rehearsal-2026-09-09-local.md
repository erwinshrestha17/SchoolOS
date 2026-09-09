# Monitoring alert rehearsal (2026-09-09, local)

Status: PASS

- Monitor observed an initial healthy state.
- Mock readiness changed to HTTP 503 with `degraded` status for longer than the configured rehearsal threshold.
- Monitor delivered one `schoolos.unhealthy` webhook.
- After dependency recovery, monitor delivered one `schoolos.recovered` webhook.
- Webhook order: schoolos.unhealthy -> schoolos.recovered.

This proves transition and payload delivery against local mock endpoints only. Configure and rehearse the real alert destination and hosting metrics on TLS staging before release approval.
