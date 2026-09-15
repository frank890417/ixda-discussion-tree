import { SttAdapter } from './adapter.js';

/**
 * Chrome Web Speech API adapter (zh-TW).
 * Only finals should feed the board; interim is for "listening" UI.
 */
export class WebSpeechAdapter extends SttAdapter {
  /** @param {import('./adapter.js').SttHandlers} handlers */
  constructor(handlers = {}) {
    super(handlers);
    this.handlers = handlers;
    this._listening = false;
    this._recognition = null;
    this._restartTimer = null;
  }

  static isSupported() {
    return !!(
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }

  get listening() {
    return this._listening;
  }

  async start() {
    if (!WebSpeechAdapter.isSupported()) {
      this.handlers.onError?.('沒有語音辨識 API。請用桌面版 Google Chrome。');
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      this.handlers.onError?.('需要安全連線（https 或 localhost）。');
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    this._recognition = recognition;
    recognition.lang = 'zh-TW';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this._listening = true;
      this.handlers.onState?.('listening');
    };

    recognition.onerror = (e) => {
      const err = e.error;
      if (err === 'not-allowed') {
        this._listening = false;
        this.handlers.onError?.('麥克風被拒絕。請允許後再按開始聽。');
        this.handlers.onState?.('stopped');
      } else if (err === 'network') {
        this.handlers.onError?.(
          '語音辨識需要網路（Chrome 會連到辨識服務）。請確認網路後重試。'
        );
      } else if (err === 'no-speech' || err === 'aborted') {
        // keep / ignore
      } else {
        this.handlers.onError?.('錯誤：' + err);
      }
    };

    recognition.onend = () => {
      if (this._listening) {
        this.handlers.onState?.('restarting');
        this._scheduleRestart();
      } else {
        this.handlers.onState?.('stopped');
      }
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = (res[0].transcript || '').trim();
        if (!text) continue;
        if (res.isFinal) this.handlers.onFinal?.(text);
        else interim += text;
      }
      if (interim) this.handlers.onInterim?.(interim);
    };

    this._listening = true;
    try {
      recognition.start();
    } catch (err) {
      this._listening = false;
      this.handlers.onError?.('無法啟動語音辨識：' + (err.message || err));
      this.handlers.onState?.('stopped');
    }
  }

  stop() {
    this._listening = false;
    clearTimeout(this._restartTimer);
    if (this._recognition) {
      try {
        this._recognition.onend = null;
        this._recognition.stop();
      } catch (_) {}
      this._recognition = null;
    }
    this.handlers.onState?.('stopped');
  }

  _scheduleRestart() {
    clearTimeout(this._restartTimer);
    this._restartTimer = setTimeout(() => {
      if (!this._listening || !this._recognition) return;
      try {
        this._recognition.start();
      } catch (err) {
        if (!String(err).includes('InvalidStateError')) {
          this.handlers.onError?.('重啟辨識失敗');
        }
      }
    }, 280);
  }
}
