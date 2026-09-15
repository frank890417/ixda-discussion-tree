const KIND_LABEL = {
  theme: '主題',
  idea: '點子',
  conclusion: '結論',
  open: '待決',
  question: '問題',
};

const SPEAKER_LABEL = {
  S1: '語者1',
  S2: '語者2',
  S3: '語者3',
  S4: '語者4',
  S5: '語者5',
  unknown: '未標',
};

/**
 * @param {HTMLElement} root
 * @param {import('../model/board.js').Board} board
 */
export function renderBoardView(root, board) {
  root.innerHTML = '';
  if (!board.clusters.length) {
    const empty = document.createElement('div');
    empty.className = 'board-empty';
    empty.innerHTML =
      '<p>還沒有凝結出主題簇。</p><p class="dim">按「開始聽」說話，或用下方手動輸入／Demo。用 1／2／3 切語者。</p>';
    root.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'cluster-grid';

  const clusters = [...board.clusters].sort((a, b) => {
    const ta = Math.max(
      0,
      ...board.ideas.filter((i) => i.clusterId === a.id).map((i) => i.updatedAt || 0)
    );
    const tb = Math.max(
      0,
      ...board.ideas.filter((i) => i.clusterId === b.id).map((i) => i.updatedAt || 0)
    );
    return tb - ta;
  });

  for (const cluster of clusters) {
    const col = document.createElement('section');
    col.className = 'cluster-col';
    const head = document.createElement('header');
    head.className = 'cluster-head';
    const ideas = board.ideas
      .filter((i) => i.clusterId === cluster.id)
      .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);

    const speakers = new Set();
    for (const idea of ideas) {
      for (const s of idea.speakerIds || []) {
        if (s && s !== 'unknown') speakers.add(s);
      }
    }
    const dots = [...speakers]
      .sort()
      .map((s) => `<span class="speaker-dot ${s}" title="${SPEAKER_LABEL[s] || s}">${s.replace('S', '')}</span>`)
      .join('');

    head.innerHTML = `<div><h2>${escapeHtml(cluster.label)}</h2><div class="speaker-dots">${dots}</div></div><span class="count">${ideas.length}</span>`;
    col.appendChild(head);

    const list = document.createElement('div');
    list.className = 'idea-list';
    for (const idea of ideas) {
      const card = document.createElement('article');
      card.className = `idea-card kind-${idea.kind}`;
      const ideaDots = (idea.speakerIds || [])
        .filter((s) => s && s !== 'unknown')
        .map((s) => `<span class="speaker-dot ${s}" title="${SPEAKER_LABEL[s] || s}">${s.replace('S', '')}</span>`)
        .join('');
      card.innerHTML = `
        <div class="idea-meta">
          <span class="kind-badge kind-${idea.kind}">${KIND_LABEL[idea.kind] || idea.kind}</span>
          <span class="score" title="重複／強調">×${idea.score}</span>
        </div>
        <p class="idea-text">${escapeHtml(idea.text)}</p>
        ${ideaDots ? `<div class="speaker-dots" style="margin-top:8px">${ideaDots}</div>` : ''}
      `;
      list.appendChild(card);
    }
    col.appendChild(list);
    grid.appendChild(col);
  }

  root.appendChild(grid);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
