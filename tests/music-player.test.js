const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 隔离 Electron 和系统进程，验证应用选择持久化与控制分流的外部结果。
function harness({ bundleId = 'com.apple.Music', canceled = false, malformed = false, save = true } = {}) {
  const handlers = {};
  let stored = {};
  const launches = [];
  const scripts = [];
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const start = source.indexOf('// 应用路径只由主进程的系统选择器写入');
  const end = source.indexOf('// ============ 百炼实时语音转写', start);
  const context = {
    path, process: { platform: 'darwin' }, SODA_MUSIC_APP: '/Applications/汽水音乐.app',
    sodaMusicPlaying: false, mainWindow: null,
    getJsonSettingsPath: name => name, readJsonFile: () => stored,
    writeJsonFile: (file, value) => { if (save) stored = value; return save; },
    execFile: (file, args, options, callback) => callback(null, malformed ? 'broken' : JSON.stringify({ CFBundleIdentifier: bundleId })),
    showOwnedOpenDialog: async () => ({ canceled, filePaths: ['/Applications/Player.app'] }),
    launchMusicApp: async appPath => { launches.push(appPath); return true; },
    runJxa: async (script, args) => { scripts.push(args); return JSON.stringify({ ok: true, playing: true }); },
    ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
  };
  vm.runInNewContext(source.slice(start, end), context);
  return { handlers, launches, scripts, stored: () => stored };
}

test('music selection persists only a validated native application', async () => {
  const h = harness();
  assert.equal((await h.handlers['music:choose']()).ok, true);
  assert.equal(h.stored().path, '/Applications/Player.app');
  assert.equal((await h.handlers['music:status']()).name, 'Player');
});

test('canceling music selection preserves existing settings', async () => {
  const h = harness({ canceled: true });
  assert.equal((await h.handlers['music:choose']()).canceled, true);
  assert.deepEqual(h.stored(), {});
});

test('invalid app metadata and failed writes do not replace selection', async () => {
  for (const options of [{ malformed: true }, { save: false }]) {
    const h = harness(options);
    assert.equal((await h.handlers['music:choose']()).ok, false);
    assert.deepEqual(h.stored(), {});
  }
});

test('unadapted music clients only launch and reject track controls', async () => {
  const h = harness({ bundleId: 'example.player' });
  await h.handlers['music:choose']();
  assert.equal((await h.handlers['music:status']()).controllable, false);
  assert.equal((await h.handlers['music:control'](null, 'next')).error, 'unsupported_control');
  assert.equal((await h.handlers['music:control'](null, 'play')).opened, true);
  assert.deepEqual(h.launches, ['/Applications/Player.app']);
  assert.equal(h.scripts.length, 0);
});

test('Apple Music and Spotify controls target the selected app through script adapter', async () => {
  for (const bundleId of ['com.apple.Music', 'com.spotify.client']) {
    const h = harness({ bundleId });
    await h.handlers['music:choose']();
    assert.equal((await h.handlers['music:control'](null, 'next')).playing, true);
    assert.equal(h.scripts[0][0], '/Applications/Player.app');
    assert.equal(h.scripts[0][1], 'next');
    assert.equal((await h.handlers['music:control'](null, 'arbitrary')).error, 'invalid_action');
    assert.equal(h.scripts.length, 1);
  }
});
