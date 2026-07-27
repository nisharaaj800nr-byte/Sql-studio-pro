---
name: Long SQL execution
description: Constraints for long multi-statement SQL scripts in the mobile editor
---

The UI timeout around expo-sqlite is not a native cancellation mechanism. A timed-out statement can continue running, so the editor must hold an execution lock until the underlying promise settles and must consume late rejections.

**Why:** Overlapping a still-running native SQLite operation with a second run can destabilize the database bridge and look like an app crash, especially for long scripts.

**How to apply:** Keep syntax highlighting, diagnostics, and autocomplete lightweight for large documents; surface timeout results in the result panel rather than letting them escape as unhandled errors.