/**
 * Pure front-end condense rules (no LLM).
 * Pipeline: normalize → classifyKind → findOrMergeIdea → assignCluster
 */

import {
  uid,
  addUtterance,
  upsertIdea,
  upsertCluster,
  linkIdeaToCluster,
  saveBoard,
} from '../model/board.js';

const FILLERS = [
  '嗯', '啊', '呃', '欸', '唉', '喔', '哦', '吼',
  '就是', '然後', '那個', '這個', '這樣', '那樣',
  '其實', '好像', '大概', '差不多', '基本上',
  '你知道', '我覺得說', '怎麼說',
];

const MERGE_THRESHOLD = 0.42;
const CLUSTER_THRESHOLD = 0.28;
const MAX_TEXT_LEN = 80;

/** @param {string} text */
export function normalize(text) {
  let t = String(text || '').trim();
  if (!t) return '';
  // strip common fillers (whole-token-ish)
  for (const f of FILLERS) {
    const re = new RegExp(f, 'g');
    t = t.replace(re, '');
  }
  t = t.replace(/\s+/g, ' ').replace(/[　\u200b]+/g, '').trim();
  // collapse repeated punctuation
  t = t.replace(/([？?！!。，,、])\1+/g, '$1');
  if ([...t].length > MAX_TEXT_LEN) {
    t = [...t].slice(0, MAX_TEXT_LEN).join('') + '…';
  }
  return t;
}

/**
 * @param {string} text
 * @returns {'theme'|'idea'|'conclusion'|'open'|'question'}
 */
export function classifyKind(text) {
  const t = text || '';
  if (/[？?]/.test(t) || /嗎|怎麼|為什麼|如何|什麼|哪[裡裏個]/.test(t)) {
    return 'question';
  }
  // open before conclusion so「還沒定案」≠ conclusion
  if (/還沒|待決|不確定|之後再|再說|待定|懸著|還沒定/.test(t)) {
    return 'open';
  }
  if (/應該|決定|就定|結論|定案|確定了|拍板|就這樣定/.test(t)) {
    return 'conclusion';
  }
  if (/主題是|我們在講|今天主題|這島是|核心是/.test(t)) {
    return 'theme';
  }
  return 'idea';
}

/** @param {string} s */
function bigrams(s) {
  const chars = [...s.replace(/\s+/g, '')];
  if (chars.length < 2) return new Set(chars);
  const set = new Set();
  for (let i = 0; i < chars.length - 1; i++) {
    set.add(chars[i] + chars[i + 1]);
  }
  return set;
}

/**
 * Character bigram Jaccard-ish overlap.
 * @param {string} a
 * @param {string} b
 */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) {
    // fallback: char overlap
    const ca = new Set([...a]);
    const cb = new Set([...b]);
    let inter = 0;
    for (const c of ca) if (cb.has(c)) inter++;
    return inter / Math.max(ca.size, cb.size, 1);
  }
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.max(A.size, B.size, 1);
}

/** @param {string} text */
export function makeClusterLabel(text) {
  const cleaned = text.replace(/[？?！!。，,、\s]+/g, '');
  const chars = [...cleaned];
  if (chars.length <= 8) return cleaned || '未命名主題';
  // prefer 4–8 chars
  const n = Math.min(8, Math.max(4, Math.ceil(chars.length / 3)));
  return chars.slice(0, n).join('');
}

/**
 * @param {import('../model/board.js').Board} board
 * @param {string} text
 * @param {string} [preferClusterId]
 */
export function findOrMergeIdea(board, text, preferClusterId) {
  const kind = classifyKind(text);
  let best = null;
  let bestScore = 0;
  const pool = preferClusterId
    ? board.ideas.filter((i) => i.clusterId === preferClusterId)
    : board.ideas;
  const search = pool.length ? pool : board.ideas;

  for (const idea of search) {
    const s = similarity(idea.text, text);
    if (s >= MERGE_THRESHOLD && s > bestScore) {
      best = idea;
      bestScore = s;
    }
  }
  // also scan global if preferred cluster had no hit
  if (!best && preferClusterId) {
    for (const idea of board.ideas) {
      const s = similarity(idea.text, text);
      if (s >= MERGE_THRESHOLD && s > bestScore) {
        best = idea;
        bestScore = s;
      }
    }
  }

  if (best) {
    best.score += 1;
    best.updatedAt = Date.now();
    if ([...text].length > [...best.text].length) best.text = text;
    // upgrade kind if stronger signal
    if (kind === 'conclusion' || kind === 'question' || kind === 'open' || kind === 'theme') {
      if (best.kind === 'idea') best.kind = kind;
    }
    upsertIdea(board, best);
    return best;
  }

  const idea = {
    id: uid('idea'),
    text,
    kind,
    clusterId: '',
    evidence: [],
    score: 1,
    speakerIds: /** @type {import('../model/board.js').SpeakerId[]} */ ([]),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  upsertIdea(board, idea);
  return idea;
}

/**
 * @param {import('../model/board.js').Board} board
 * @param {import('../model/board.js').Idea} idea
 */
export function assignCluster(board, idea) {
  if (idea.clusterId) {
    linkIdeaToCluster(board, idea.clusterId, idea.id);
    return board.clusters.find((c) => c.id === idea.clusterId);
  }

  let best = null;
  let bestScore = 0;
  for (const cluster of board.clusters) {
    const members = board.ideas.filter((i) => i.clusterId === cluster.id);
    const corpus = [cluster.label, ...members.map((m) => m.text)].join('');
    const s = similarity(corpus, idea.text);
    if (s >= CLUSTER_THRESHOLD && s > bestScore) {
      best = cluster;
      bestScore = s;
    }
  }

  if (best) {
    idea.clusterId = best.id;
    idea.updatedAt = Date.now();
    upsertIdea(board, idea);
    linkIdeaToCluster(board, best.id, idea.id);
    return best;
  }

  const cluster = {
    id: uid('cl'),
    label: makeClusterLabel(idea.text),
    ideaIds: [idea.id],
    createdAt: Date.now(),
  };
  idea.clusterId = cluster.id;
  idea.updatedAt = Date.now();
  upsertIdea(board, idea);
  upsertCluster(board, cluster);
  return cluster;
}

/**
 * Full pipeline for one final utterance.
 * @param {import('../model/board.js').Board} board
 * @param {string} rawText
 * @param {{ speakerId?: import('../model/board.js').SpeakerId, speakerSource?: 'manual'|'auto'|'enroll', persist?: boolean }} [opts]
 */
export function condenseFinal(board, rawText, opts = {}) {
  const text = normalize(rawText);
  if (!text) return null;

  const utterance = addUtterance(board, text, {
    speakerId: opts.speakerId || 'unknown',
    speakerSource: opts.speakerSource || 'manual',
  });

  const idea = findOrMergeIdea(board, text);
  if (!idea.evidence.includes(utterance.id)) idea.evidence.push(utterance.id);
  if (utterance.speakerId && utterance.speakerId !== 'unknown') {
    if (!idea.speakerIds.includes(utterance.speakerId)) {
      idea.speakerIds.push(utterance.speakerId);
    }
  }
  idea.updatedAt = Date.now();
  upsertIdea(board, idea);
  assignCluster(board, idea);

  if (opts.persist !== false) saveBoard(board);
  return { utterance, idea };
}
