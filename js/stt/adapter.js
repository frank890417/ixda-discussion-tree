/**
 * SttAdapter — pluggable speech-to-text interface.
 * PR1a: WebSpeechAdapter. Later: cloud STT without rewriting UI.
 *
 * @typedef {Object} SttHandlers
 * @property {(text: string) => void} [onFinal]
 * @property {(text: string) => void} [onInterim]
 * @property {(msg: string) => void} [onError]
 * @property {(state: 'listening'|'stopped'|'restarting') => void} [onState]
 */

/** @interface */
export class SttAdapter {
  /** @param {SttHandlers} _handlers */
  constructor(_handlers = {}) {}

  /** @returns {boolean} */
  static isSupported() {
    return false;
  }

  /** @returns {Promise<void>} */
  async start() {
    throw new Error('Not implemented');
  }

  stop() {}

  /** @returns {boolean} */
  get listening() {
    return false;
  }
}
