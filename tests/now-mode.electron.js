const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const profile = process.env.TODO_TEST_USER_DATA;
if (!profile) throw new Error('TODO_TEST_USER_DATA is required.');
app.commandLine.appendSwitch('user-data-dir', profile);
if (process.platform === 'darwin') app.commandLine.appendSwitch('use-mock-keychain');

const nowModeStorage = {
  P0: [],
  P1: [],
  P2: [{
    id: 'now-mode-task',
    text: '检查现在模式的真实窗口布局',
    done: false,
    createdAt: 1788709776699,
    deadline: '2026-09-11T15:30:00.000Z',
    remindedAt: 0,
  }],
  P3: [],
};

const timeout = setTimeout(() => {
  console.error('Now mode Electron check timed out');
  app.exit(1);
}, 30000);
let reloadedForFixture = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (details) => {
    if (details.level === 'error') console.error(details.message);
  });
  contents.on('did-finish-load', async () => {
    if (!contents.getURL().endsWith('/renderer/index.html')) return;
    try {
      // 首次加载注入独立测试数据后刷新，确保页面的模块状态从真实 LocalStorage 初始化。
      if (!reloadedForFixture) {
        reloadedForFixture = true;
        await contents.executeJavaScript(`
          localStorage.setItem('notch-todo-data', ${JSON.stringify(JSON.stringify(nowModeStorage))});
          localStorage.setItem('notch-home-view-v1', 'now');
          localStorage.setItem('notch-task-completion-inbox-v1', ${JSON.stringify(JSON.stringify([{
            id: 'codex:now-mode-result',
            title: '现在模式的 AI 结果已完成',
            source: 'codex',
            project: 'TO-DO Panel',
            detail: '可验证收件箱、归档与转为待办。',
            receivedAt: 1788709776699,
            archived: false,
          }]))});
          location.reload();
        `);
        return;
      }

      await wait(300);
      const window = BrowserWindow.fromWebContents(contents);
      // 刘海点击与焦点收起已由 notch-focus 覆盖；这里稳定展开窗口，专测现在模式内容。
      await contents.executeJavaScript(`window.notchAPI.setMode('expanded')`);
      await wait(900);

      const initialState = await contents.executeJavaScript(`({
        bounds: { width: window.innerWidth, height: window.innerHeight },
        nowVisible: !document.getElementById('now-dashboard').hidden,
        workbenchHidden: document.getElementById('home-bento').hidden,
        title: document.getElementById('now-task-title').textContent,
        focusLabel: document.getElementById('now-focus-button').textContent,
      })`);
      assert.equal(initialState.nowVisible, true);
      assert.equal(initialState.workbenchHidden, true);
      assert.equal(initialState.title, '检查现在模式的真实窗口布局');
      assert.equal(initialState.focusLabel, '开始专注');
      assert.equal(initialState.bounds.width, 1240);
      assert.equal(initialState.bounds.height, 616);

      await contents.executeJavaScript(`document.getElementById('now-focus-button').click()`);
      await wait(40);
      assert.equal(await contents.executeJavaScript(`document.getElementById('now-focus-button').textContent`), '暂停专注');

      await contents.executeJavaScript(`document.querySelector('[data-now-action="workspace"]').click()`);
      assert.equal(await contents.executeJavaScript(`document.getElementById('home-bento').hidden`), false);
      await contents.executeJavaScript(`document.getElementById('now-workspace-return').click()`);
      assert.equal(await contents.executeJavaScript(`document.getElementById('now-dashboard').hidden`), false);

      await contents.executeJavaScript(`document.getElementById('now-inbox-open').click()`);
      assert.equal(await contents.executeJavaScript(`document.getElementById('completion-inbox').hidden`), false);
      assert.equal(await contents.executeJavaScript(`document.querySelector('.completion-inbox-item strong').textContent`), '现在模式的 AI 结果已完成');
      const inboxGeometry = await contents.executeJavaScript(`(() => {
        const panel = document.querySelector('.completion-inbox-panel');
        const bounds = panel.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height, zIndex: getComputedStyle(panel).zIndex };
      })()`);
      assert.ok(inboxGeometry.width >= 500);
      assert.ok(inboxGeometry.height >= 160);
      assert.equal(inboxGeometry.zIndex, '1');
      // 等待浏览器提交弹层合成帧，避免 QA 截图仍停留在点击前的首页画面。
      await wait(100);
      const inboxScreenshotPath = process.env.TODO_TEST_INBOX_SCREENSHOT;
      if (inboxScreenshotPath) {
        const inboxCapture = await contents.capturePage();
        fs.mkdirSync(path.dirname(inboxScreenshotPath), { recursive: true });
        fs.writeFileSync(inboxScreenshotPath, inboxCapture.toPNG());
      }
      await contents.executeJavaScript(`document.querySelector('[data-inbox-action="next"]').click()`);
      await wait(150);
      assert.equal(await contents.executeJavaScript(`document.querySelector('.add-row input[data-priority="P2"]').value`), '跟进：现在模式的 AI 结果已完成');
      await contents.executeJavaScript(`document.getElementById('tab-button-home').click()`);
      await wait(100);
      await contents.executeJavaScript(`document.getElementById('now-inbox-open').click()`);
      await contents.executeJavaScript(`document.querySelector('[data-inbox-action="archive"]').click()`);
      assert.equal(await contents.executeJavaScript(`document.querySelector('.completion-inbox-empty').textContent`), '新的 Codex、Claude 或 GPT 完成结果会出现在这里。');
      await contents.executeJavaScript(`document.querySelector('[data-inbox-filter="archived"]').click()`);
      assert.equal(await contents.executeJavaScript(`document.querySelector('[data-inbox-action="archive"]').textContent`), '恢复');
      await contents.executeJavaScript(`document.querySelector('[data-inbox-action="close"]').click()`);

      // CI 只验证截图可生成；人工 QA 可通过环境变量取回同一张真实 Electron 画面。
      const screenshotPath = process.env.TODO_TEST_SCREENSHOT;
      if (screenshotPath) {
        const capture = await contents.capturePage();
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        fs.writeFileSync(screenshotPath, capture.toPNG());
        assert.deepEqual(capture.getSize(), { width: 1240, height: 616 });
      }

      console.log('Now mode Electron checks passed');
      clearTimeout(timeout);
      window?.destroy();
      app.quit();
    } catch (error) {
      console.error(error);
      clearTimeout(timeout);
      app.exit(1);
    }
  });
});

require('../main.js');
