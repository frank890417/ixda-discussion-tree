/**
 * Tree view projected from board (clusters → trunks, ideas → branches).
 * No more tokenize-and-random-hang from raw speech.
 */

/**
 * @typedef {Object} TreeNode
 * @property {string} text
 * @property {number} x
 * @property {number} y
 * @property {number} angle
 * @property {number} depth
 * @property {TreeNode[]} children
 * @property {number} born
 * @property {number} [len]
 * @property {string} [kind]
 */

/**
 * @param {import('../model/board.js').Board} board
 * @returns {{ root: TreeNode, nodes: TreeNode[] }}
 */
export function projectTreeFromBoard(board) {
  const now = performance.now();
  /** @type {TreeNode} */
  const root = {
    text: board.island || '呼吸',
    x: 0,
    y: 0,
    angle: -Math.PI / 2,
    depth: 0,
    children: [],
    born: now,
  };
  const nodes = [root];

  const clusters = board.clusters.length
    ? board.clusters
    : [{ id: '_empty', label: '（空）', ideaIds: [], createdAt: Date.now() }];

  clusters.forEach((cluster, ci) => {
    const spread = 0.9;
    const offset = (ci - (clusters.length - 1) / 2) * spread;
    /** @type {TreeNode} */
    const cNode = {
      text: cluster.label,
      x: 0,
      y: 0,
      angle: root.angle + offset,
      depth: 1,
      children: [],
      born: now - 200,
      len: 70 + (ci % 3) * 8,
      kind: 'theme',
    };
    root.children.push(cNode);
    nodes.push(cNode);

    const ideas = board.ideas
      .filter((i) => i.clusterId === cluster.id)
      .sort((a, b) => b.score - a.score);
    ideas.forEach((idea, ii) => {
      const ispread = 0.45;
      const ioff = (ii - (ideas.length - 1) / 2) * ispread;
      /** @type {TreeNode} */
      const iNode = {
        text: idea.text.length > 10 ? [...idea.text].slice(0, 10).join('') + '…' : idea.text,
        x: 0,
        y: 0,
        angle: cNode.angle + ioff,
        depth: 2,
        children: [],
        born: now - 100 + ii * 30,
        len: 48 + Math.min(24, idea.score * 4),
        kind: idea.kind,
      };
      cNode.children.push(iNode);
      nodes.push(iNode);
    });
  });

  return { root, nodes };
}

/**
 * Simple canvas renderer for projected tree.
 */
export class TreeView {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => string} getIsland
   */
  constructor(canvas, getIsland) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.getIsland = getIsland;
    this.root = null;
    this.nodes = [];
    this.W = 0;
    this.H = 0;
    this.dpr = 1;
    this.pulse = 0;
    this._raf = 0;
    this.visible = false;
  }

  /** @param {import('../model/board.js').Board} board */
  setBoard(board) {
    const { root, nodes } = projectTreeFromBoard(board);
    this.root = root;
    this.nodes = nodes;
    this.pulse = 1;
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  show() {
    this.visible = true;
    this.canvas.classList.remove('hidden');
    this.resize();
    if (!this._raf) this._loop();
  }

  hide() {
    this.visible = false;
    this.canvas.classList.add('hidden');
  }

  _layout() {
    if (!this.root) return;
    this.root.x = this.W * 0.5;
    this.root.y = this.H * 0.78;
    const walk = (n) => {
      for (const c of n.children) {
        const len = c.len || 50;
        const targetX = n.x + Math.cos(c.angle) * len;
        const targetY = n.y + Math.sin(c.angle) * len;
        c.x += (targetX - c.x) * 0.22;
        c.y += (targetY - c.y) * 0.22;
        walk(c);
      }
    };
    walk(this.root);
  }

  _loop = () => {
    this._raf = requestAnimationFrame(this._loop);
    if (!this.visible || !this.root) return;
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.7, 20, W / 2, H * 0.55, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(30,70,50,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    this._layout();
    this.pulse *= 0.92;

    const drawEdge = (n) => {
      for (const c of n.children) {
        const age = Math.min(1, (performance.now() - c.born) / 700);
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        const mx = (n.x + c.x) / 2 + Math.sin(c.angle) * 12 * age;
        const my = (n.y + c.y) / 2 - Math.cos(c.angle) * 12 * age;
        ctx.quadraticCurveTo(mx, my, c.x, c.y);
        ctx.strokeStyle = `rgba(125,255,163,${0.18 + 0.35 * age})`;
        ctx.lineWidth = Math.max(1, 4.5 - c.depth * 0.45);
        ctx.stroke();
        drawEdge(c);
      }
    };
    drawEdge(this.root);

    for (const n of this.nodes) {
      const age = Math.min(1, (performance.now() - n.born) / 600);
      const r = (n.depth === 0 ? 7 : 3.2) + this.pulse * 2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle =
        n.depth === 0
          ? 'rgba(125,255,163,0.85)'
          : `rgba(200,255,220,${0.35 + 0.5 * age})`;
      ctx.fill();
      ctx.font =
        n.depth === 0
          ? '600 16px "PingFang TC", sans-serif'
          : `${Math.max(11, 14 - n.depth)}px "PingFang TC", sans-serif`;
      ctx.fillStyle = `rgba(232,240,234,${0.55 + 0.4 * age})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const label = n.depth === 0 ? this.getIsland() || n.text : n.text;
      ctx.fillText(label, n.x, n.y - 10);
    }
  };
}
