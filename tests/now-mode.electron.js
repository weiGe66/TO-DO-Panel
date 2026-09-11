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
          location.reload();
        `);
        return;
      }

      await wait(300);
      const window = BrowserWindow.fromWebContents(contents);
      await contents.executeJavaScript(`document.getElementById('notch').click()`);
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
