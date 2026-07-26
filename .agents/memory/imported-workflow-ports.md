---
name: Imported workflow ports
description: Replit workflow behavior for imported PNPM artifacts whose metadata is present but not registered.
---

Imported projects can contain valid `.replit-artifact/artifact.toml` files without those artifact workflows appearing in the workspace registry. When configuring equivalent workflows directly, pass the service port in the command itself instead of assuming artifact-managed environment injection.

**Why:** Without an injected `PORT`, both Expo's `--port $PORT` and the API's required `PORT` check fail before the services start.

**How to apply:** Check the workflow registry after import; if it is empty, configure the existing app commands with their documented service ports and verify both the preview response and API health endpoint.