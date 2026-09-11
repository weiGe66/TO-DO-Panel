# 现在模式 · Design QA

**Comparison target**

- Source visual truth: `/Users/zhengwei/.codex/generated_images/01a08f2d-dea8-75e0-a934-7f127d760b44/exec-141f6563-fff0-48b2-95bb-ec578ba46703.png`.
- Rendered implementation: [`docs/screenshots/now-mode-qa.png`](docs/screenshots/now-mode-qa.png), captured with Electron `webContents.capturePage()`.
- Source dimensions: 1780 × 884 px. Implementation dimensions: 1240 × 616 px, with a matching 2.013:1 frame ratio after normalization. Implementation CSS viewport: 1240 × 616 at density 1. State: expanded home, one due task, and active Pomodoro.

**Full-view comparison evidence**

The Electron capture preserves the reference's top tab bar, dark low-contrast panels, three-part hierarchy (next action, timer, upcoming list), completion strip, and quick-capture bar. The source and implementation use effectively the same frame ratio; the implementation also proves the project’s fixed 1240 × 540 content region inside the 1240 × 616 window.

**Focused region comparison**

The focus-action region was checked in Electron. Selecting “开始专注” changed the displayed action to “暂停专注” and the timer status to “专注进行中”. The workbench switch was also checked in both directions. No additional focused crop was needed: all critical text and controls are readable in the fixed-window capture.

**Findings**

No actionable P0/P1/P2 differences remain. The earlier fixed-window capture gap was resolved with the Electron screenshot above.

**Required fidelity surfaces**

- Fonts and typography: uses the existing system font stack; native Electron hierarchy, weights, and truncation are legible in the capture.
- Spacing and layout rhythm: the three-column focus layout, completion strip, capture row, radii, and compact tab bar fit the fixed window without overflow.
- Colors and visual tokens: reuses existing `--surface-*`, `--text-*`, and semantic accent tokens; no new image or gradient asset is introduced.
- Image quality and asset fidelity: the selected direction contains no required custom image asset; existing app icons remain untouched.
- Copy and content: empty states, dynamic to-do context, Pomodoro labels, and AI completion copy were checked.

**Implementation checklist**

- [x] Use existing `notch-todo-data` as the sole task data source.
- [x] Bind the focus action to the existing Pomodoro state machine.
- [x] Surface the latest local AI completion event when available.
- [x] Preserve the original Bento workbench behind a persisted view switch.
- [x] Capture and compare the real Electron fixed-window view.

**Follow-up polish**

- [P3] A subtle category-color accent on the current-task card remains optional; the current neutral treatment keeps the primary action clear.

final result: passed
