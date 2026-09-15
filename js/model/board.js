/** localStorage key for board persistence */
export const STORAGE_KEY = 'breathing-islands:board:v1';

/** @typedef {'theme'|'idea'|'conclusion'|'open'|'question'} Kind */
/** @typedef {'unknown'|'S1'|'S2'|'S3'|'S4'|'S5'} SpeakerId */

/**
 * @typedef {Object} Utterance
 * @property {string} id
 * @property {string} text
 * @property {number} at
 * @property {SpeakerId} speakerId
 * @property {'manual'|'auto'|'enroll'} speakerSource
 */

/**
 * @typedef {Object} Idea
 * @property {string} id
 * @property {string} text
 * @property {Kind} kind
 * @property {string} clusterId
 * @property {string[]} evidence
 * @property {number} score
 * @property {SpeakerId[]} speakerIds
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} Cluster
 * @property {string} id
 * @property {string} label
 * @property {string[]} ideaIds
 * @property {number} createdAt
 */

/**
 * @typedef {Object} Board
 * @property {1} version
 * @property {string} island
 * @property {Utterance[]} utterances
 * @property {Idea[]} ideas
 * @property {Cluster[]} clusters
 */

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** @returns {Board} */
export function createEmptyBoard(island = '未命名的島') {
  return {
    version: 1,
    island,
    utterances: [],
    ideas: [],
    clusters: [],
  };
}

/** @param {any} raw @returns {Board} */
export function normalizeBoard(raw) {
  const base = createEmptyBoard();
  if (!raw || typeof raw !== 'object') return base;
  return {
    version: 1,
    island: typeof raw.island === 'string' && raw.island ? raw.island : base.island,
    utterances: Array.isArray(raw.utterances) ? raw.utterances : [],
    ideas: Array.isArray(raw.ideas) ? raw.ideas : [],
    clusters: Array.isArray(raw.clusters) ? raw.clusters : [],
  };
}

export function loadBoard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyBoard();
    return normalizeBoard(JSON.parse(raw));
  } catch (_) {
    return createEmptyBoard();
  }
}

/** @param {Board} board */
export function saveBoard(board) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
}

/** @param {Board} board */
export function clearBoard(board) {
  board.utterances = [];
  board.ideas = [];
  board.clusters = [];
  saveBoard(board);
  return board;
}

/**
 * @param {Board} board
 * @param {string} text
 * @param {{ speakerId?: SpeakerId, speakerSource?: 'manual'|'auto'|'enroll' }} [opts]
 * @returns {Utterance}
 */
export function addUtterance(board, text, opts = {}) {
  /** @type {Utterance} */
  const u = {
    id: uid('u'),
    text,
    at: Date.now(),
    speakerId: opts.speakerId || 'unknown',
    speakerSource: opts.speakerSource || 'manual',
  };
  board.utterances.push(u);
  return u;
}

/**
 * @param {Board} board
 * @param {Idea} idea
 */
export function upsertIdea(board, idea) {
  const i = board.ideas.findIndex((x) => x.id === idea.id);
  if (i >= 0) board.ideas[i] = idea;
  else board.ideas.push(idea);
}

/**
 * @param {Board} board
 * @param {Cluster} cluster
 */
export function upsertCluster(board, cluster) {
  const i = board.clusters.findIndex((x) => x.id === cluster.id);
  if (i >= 0) board.clusters[i] = cluster;
  else board.clusters.push(cluster);
}

/**
 * @param {Board} board
 * @param {string} clusterId
 * @param {string} ideaId
 */
export function linkIdeaToCluster(board, clusterId, ideaId) {
  const c = board.clusters.find((x) => x.id === clusterId);
  if (!c) return;
  if (!c.ideaIds.includes(ideaId)) c.ideaIds.push(ideaId);
}
