const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

// 使用测试运行器提供的临时配置，系统选择器与播放器由桩替代，避免改变真实播放会话。
app.setPath('userData', process.env.TODO_TEST_USER_DATA);
const timeout = setTimeout(() => { console.error('Music renderer test timed out'); app.exit(1); }, 20000);
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1240, height: 616, show: false, webPreferences: { backgroundThrottling: false } });
  try {
    await window.loadFile(path.join(__dirname, '../renderer/index.html'));
    const result = await window.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      // 音乐组件属于完整工作台；现在模式默认首页不渲染该组件的可点击区域。
      document.querySelector('[data-now-action="workspace"]')?.click();
      const choose = document.getElementById('music-app-choose');
      const title = document.getElementById('music-title');
      const card = document.getElementById('home-music');
      const play = document.getElementById('music-play-toggle');
      let status = { installed: true, name: 'QQMusic', controllable: false, playing: false };
      let canceled = false;
      const calls = [];
      window.notchAPI = {
        chooseMusicApp: async () => canceled ? { canceled: true } : { ok: true },
        getMusicStatus: async () => status,
        controlMusic: async action => { calls.push(action); return { ok: true, playing: status.controllable }; },
      };
      choose.click();
      await sleep(50);
      const launchOnly = { name: title.textContent, label: play.getAttribute('aria-label'),
        hidden: [...card.querySelectorAll('[data-music-action]')].filter(b => getComputedStyle(b).display === 'none').length,
        controls: calls.length, enabled: !choose.disabled };
      play.click();
      await sleep(550);
      status = { installed: true, name: 'Music', controllable: true, playing: true };
      choose.click();
      await sleep(50);
      const adapted = { name: title.textContent, label: play.getAttribute('aria-label'),
        hidden: [...card.querySelectorAll('[data-music-action]')].filter(b => getComputedStyle(b).display === 'none').length };
      canceled = true;
      choose.click();
      await sleep(50);
      const afterCancel = title.textContent;
      // 用真实样式检查每种布局下更换入口的点击区域，避免新入口与旧控件重叠。
      document.getElementById('app').classList.remove('collapsed');
      document.getElementById('app').classList.add('expanded');
      document.querySelector('.panel').inert = false;
      document.querySelectorAll('.tab-panel').forEach(panel => { panel.classList.toggle('active', panel.id === 'tab-home'); panel.inert = false; });
      document.getElementById('tab-home').style.display = 'block';
      card.style.position = 'fixed'; card.style.left = '100px'; card.style.top = '100px'; card.style.zIndex = '100';
      const hitTests = [];
      for (const [variant, width, height] of [['mini',180,92],['compact',240,160],['wide',400,160],['tall',240,340],['full',400,340]]) {
        card.dataset.layoutVariant = variant;
        card.style.width = width + 'px'; card.style.height = height + 'px';
        await sleep(30);
        const rect = choose.getBoundingClientRect();
        hitTests.push({ variant, hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === choose });
      }
      return { launchOnly, adapted, afterCancel, calls, hitTests };
    })()`);
    if (process.env.TODO_MUSIC_SCREENSHOT) fs.writeFileSync(process.env.TODO_MUSIC_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
    assert.deepEqual(result.launchOnly, { name: 'QQMusic', label: '打开音乐软件', hidden: 2, controls: 0, enabled: true });
    assert.deepEqual(result.adapted, { name: 'Music', label: '暂停', hidden: 0 });
    assert.equal(result.afterCancel, 'Music');
    assert.deepEqual(result.calls, ['play']);
    assert.ok(result.hitTests.every(row => row.hit), JSON.stringify(result.hitTests));
    console.log('Music renderer checks passed: selection, cancel, launch-only controls, adapted controls, five layout hit targets');
    clearTimeout(timeout);
    app.quit();
  } catch (error) { console.error(error); app.exit(1); }
});
