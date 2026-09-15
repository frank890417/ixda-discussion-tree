import { normalizeBoard, saveBoard } from './model/board.js';

/** @param {import('./model/board.js').Board} board */
export function exportBoardJson(board) {
  const blob = new Blob([JSON.stringify(board, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (board.island || 'island').replace(/[^\w\u4e00-\u9fff-]+/g, '_');
  a.href = url;
  a.download = `breathing-islands-${safe}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {File} file
 * @returns {Promise<import('./model/board.js').Board>}
 */
export function importBoardJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        const board = normalizeBoard(data);
        saveBoard(board);
        resolve(board);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('讀檔失敗'));
    reader.readAsText(file, 'utf-8');
  });
}
