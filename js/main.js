import { WebSpeechAdapter } from './stt/web-speech.js';
import {
  loadBoard,
  saveBoard,
  clearBoard,
} from './model/board.js';
import { condenseFinal } from './condense/rules.js';
import { renderBoardView } from './views/board-view.js';
import { TreeView } from './views/tree-view.js';
import { exportBoardJson, importBoardJson } from './export.js';

const $ = (id) => document.getElementById(id);

const toggleBtn = $('toggle');
const clearBtn = $('clear');
const fullBtn = $('full');
const demoBtn = $('demo');
const toggleLogBtn = $('toggleLog');
const exportBtn = $('exportBtn');
const importBtn = $('importBtn');
const fileImport = $('fileImport');
const modeBoardBtn = $('modeBoard');
const modeTreeBtn = $('modeTree');
const manualInput = $('manualInput');
const manualSend = $('manualSend');
const statusEl = $('status');
const logEl = $('log');
const islandEl = $('island');
const banner = $('banner');
const heardEl = $('heard');
const meterEl = $('meter');
const boardRoot = $('boardRoot');
const canvas = $('c');
const speakerSwitch = $('speakerSwitch');

/** @type {import('./model/board.js').SpeakerId} */
let activeSpeaker = 'S1';

/** @type {import('./model/board.js').Board} */
let board = loadBoard();
islandEl.value = board.island || '未命名的島';

let mode = 'board'; // 'board' | 'tree'
let audioCtx = null;
let analyser = null;
let micStream = null;
let rafMeter = null;

const treeView = new TreeView(canvas, () => islandEl.value || board.island || '呼吸');

function showBanner(msg) {
  banner.textContent = msg;
  banner.style.display = 'block';
}
function hideBanner() {
  banner.style.display = 'none';
}

function setStatus(text, on) {
  statusEl.textContent = text;
  statusEl.classList.toggle('on', !!on);
}

function setHeard(text, dim) {
  if (dim) heardEl.innerHTML = '<span class="dim">' + text + '</span>';
  else heardEl.textContent = text;
}

function addLog(text, kind, speakerId) {
  const div = document.createElement('div');
  div.className = kind;
  if (speakerId && speakerId !== 'unknown') {
    div.classList.add('speaker-' + speakerId);
    const tag = document.createElement('span');
    tag.className = 'log-speaker ' + speakerId;
    tag.textContent = speakerId.replace('S', '語者');
    div.appendChild(tag);
  }
  div.appendChild(document.createTextNode(text));
  logEl.prepend(div);
  while (logEl.children.length > 40) logEl.lastChild.remove();
}

function setActiveSpeaker(id) {
  if (!['S1', 'S2', 'S3'].includes(id)) return;
  activeSpeaker = id;
  speakerSwitch.querySelectorAll('.speaker-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.speaker === id);
  });
  setStatus('語者 ' + id.replace('S', '') + ' 發言中', true);
}

function render() {
  if (mode === 'board') {
    document.body.classList.add('mode-board');
    document.body.classList.remove('mode-tree');
    boardRoot.classList.remove('hidden');
    treeView.hide();
    renderBoardView(boardRoot, board);
    modeBoardBtn.classList.add('active');
    modeTreeBtn.classList.remove('active');
  } else {
    document.body.classList.add('mode-tree');
    document.body.classList.remove('mode-board');
    boardRoot.classList.add('hidden');
    treeView.setBoard(board);
    treeView.show();
    modeTreeBtn.classList.add('active');
    modeBoardBtn.classList.remove('active');
  }
}

function setMode(next) {
  mode = next;
  render();
}

/**
 * @param {string} text
 * @param {{ fromDemo?: boolean }} [meta]
 */
function ingestFinal(text, meta = {}) {
  const speakerId = meta.speakerId || activeSpeaker || 'S1';
  const result = condenseFinal(board, text, {
    speakerId,
    speakerSource: 'manual',
  });
  if (!result) return;
  const label = meta.fromDemo ? '[示範] ' : '';
  addLog(label + result.idea.text, 'final', speakerId);
  setHeard(result.idea.text, false);
  setStatus(
    `S${speakerId.replace('S', '')} · ${result.idea.kind} · ${result.idea.text.slice(0, 16)}`,
    true
  );
  render();
}

function tickMeter() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / data.length);
  const pct = Math.min(100, Math.floor(rms * 280));
  meterEl.style.width = pct + '%';
  rafMeter = requestAnimationFrame(tickMeter);
}

async function ensureMic() {
  if (micStream) return true;
  if (!navigator.mediaDevices?.getUserMedia) {
    showBanner('這個瀏覽器無法取用麥克風。');
    return false;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    tickMeter();
    return true;
  } catch (err) {
    showBanner(
      '麥克風權限失敗：' + (err.message || err.name) + '。到網址列鎖頭允許麥克風。'
    );
    return false;
  }
}

const stt = new WebSpeechAdapter({
  onFinal: (text) => ingestFinal(text),
  onInterim: (text) => {
    setHeard(text, false);
    const first = logEl.firstChild;
    if (first && first.classList.contains('interim')) first.textContent = text;
    else addLog(text, 'interim');
  },
  onError: (msg) => {
    showBanner(msg);
    setStatus(msg.slice(0, 24), false);
  },
  onState: (state) => {
    if (state === 'listening') {
      toggleBtn.textContent = '停止聽';
      toggleBtn.classList.add('listening');
      setStatus('聆聽中（請說話）', true);
      setHeard('…正在聽', true);
    } else if (state === 'restarting') {
      setStatus('辨識暫停，自動重接…', true);
    } else {
      toggleBtn.textContent = '開始聽';
      toggleBtn.classList.remove('listening');
      setStatus('待機', false);
      setHeard('按「開始聽」後說話，或手動輸入', true);
    }
  },
});

async function startListening() {
  hideBanner();
  if (!window.isSecureContext) {
    showBanner(
      '需要安全連線（https 或 localhost）。請開 GitHub Pages 網址，不要用檔案雙擊。'
    );
    return;
  }
  if (!WebSpeechAdapter.isSupported()) {
    showBanner('沒有語音辨識 API。請用桌面版 Google Chrome。');
    return;
  }
  const ok = await ensureMic();
  if (!ok) return;
  if (audioCtx?.state === 'suspended') await audioCtx.resume();
  await stt.start();
}

function stopListening() {
  stt.stop();
}

toggleBtn.addEventListener('click', () => {
  if (stt.listening) stopListening();
  else startListening();
});

demoBtn.addEventListener('click', () => {
  const samples = [
    { text: '今天主題是便利商店的深夜節奏', speakerId: 'S1' },
    { text: '為什麼末班車總是讓人焦慮？', speakerId: 'S2' },
    { text: '我覺得應該決定加一個休息角', speakerId: 'S1' },
    { text: '毛孩陪伴這件事還沒定案', speakerId: 'S3' },
    { text: '之後再討論加班島的燈光', speakerId: 'S2' },
    { text: '便利商店可以放慢呼吸', speakerId: 'S3' },
    { text: '結論是先做會呼吸的陳列', speakerId: 'S1' },
    { text: '我們在講溫度與節奏', speakerId: 'S2' },
  ];
  const pick = samples[Math.floor(Math.random() * samples.length)];
  setActiveSpeaker(pick.speakerId);
  ingestFinal(pick.text, { fromDemo: true, speakerId: pick.speakerId });
});

clearBtn.addEventListener('click', () => {
  if (!confirm('清空討論板（含主題簇與逐字）？')) return;
  clearBoard(board);
  logEl.innerHTML = '';
  setHeard('按「開始聽」後說話，或手動輸入', true);
  setStatus('已清空', false);
  render();
});

fullBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});

toggleLogBtn.addEventListener('click', () => {
  const hidden = logEl.classList.toggle('hidden');
  toggleLogBtn.textContent = hidden ? '顯示逐字' : '隱藏逐字';
});

modeBoardBtn.addEventListener('click', () => setMode('board'));
modeTreeBtn.addEventListener('click', () => setMode('tree'));

speakerSwitch.addEventListener('click', (e) => {
  const btn = e.target.closest('.speaker-btn');
  if (!btn) return;
  setActiveSpeaker(btn.dataset.speaker);
});

islandEl.addEventListener('change', () => {
  board.island = islandEl.value.trim() || '未命名的島';
  saveBoard(board);
  render();
});
islandEl.addEventListener('input', () => {
  board.island = islandEl.value.trim() || '未命名的島';
});

manualSend.addEventListener('click', () => {
  const t = manualInput.value.trim();
  if (!t) return;
  ingestFinal(t);
  manualInput.value = '';
  manualInput.focus();
});
manualInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    manualSend.click();
  }
});

exportBtn.addEventListener('click', () => exportBoardJson(board));
importBtn.addEventListener('click', () => fileImport.click());
fileImport.addEventListener('change', async () => {
  const file = fileImport.files?.[0];
  fileImport.value = '';
  if (!file) return;
  try {
    board = await importBoardJson(file);
    islandEl.value = board.island || '未命名的島';
    setStatus('已匯入 JSON', true);
    render();
  } catch (err) {
    showBanner('匯入失敗：' + (err.message || err));
  }
});

window.addEventListener('keydown', (e) => {
  if (e.target === islandEl || e.target === manualInput) return;
  if (e.code === 'Space') {
    e.preventDefault();
    toggleBtn.click();
  } else if (e.key === '1') setActiveSpeaker('S1');
  else if (e.key === '2') setActiveSpeaker('S2');
  else if (e.key === '3') setActiveSpeaker('S3');
  else if (e.key === 'f' || e.key === 'F') fullBtn.click();
  else if (e.key === 'c' || e.key === 'C') clearBtn.click();
  else if (e.key === 'b' || e.key === 'B') setMode('board');
  else if (e.key === 't' || e.key === 'T') setMode('tree');
});

window.addEventListener('resize', () => {
  if (mode === 'tree') treeView.resize();
});

if (!WebSpeechAdapter.isSupported()) showBanner('請用桌面版 Chrome 打開。');
else if (!window.isSecureContext) {
  showBanner(
    '請用 https://frank890417.github.io/ixda-discussion-tree/ 或 localhost 打開，不要雙擊本地檔。'
  );
}

setHeard('按「開始聽」後說話，或手動輸入', true);
setActiveSpeaker('S1');
render();
