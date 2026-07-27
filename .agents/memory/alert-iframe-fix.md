---
name: Alert.alert blocked in Replit iframe
description: Alert.alert is silently blocked inside Replit preview iframe — buttons appear unresponsive.
---

## Rule
Never use `Alert.alert` for picker or confirm dialogs. Use `PickerModal` / `ConfirmModal` from `artifacts/mobile/components/PickerModal.tsx`.

**Why:** Replit preview is a cross-origin iframe. `window.alert()` / `window.confirm()` are blocked by browsers in iframes, so the press fires but nothing shows — buttons look broken.

**How to apply:** Any new screen that needs a picker or destructive confirm must use PickerModal/ConfirmModal. Settings screen was fixed 2026-07-27.
