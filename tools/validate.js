/* 课程数据体检：演示序列每一步必须合法；每道题必须真的有解（且答案点符合规则）。
   用法：node tools/validate.js */
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'assets', 'js', 'engine.js'));

global.window = global;
require(path.join(__dirname, '..', 'data', 'curriculum.js'));
const C = global.WQ_CURRICULUM;

const B = E.BLACK, W = E.WHITE;
const errors = [], warns = [];
function err(m) { errors.push(m); }
function warn(m) { warns.push(m); }

function spec(q, extra) {
  return { size: 9, b: q.b || [], w: q.w || [] };
}
function moverOf(q) { return q.turn === 'W' ? W : B; }
function defenderOf(q) { return moverOf(q) === B ? W : B; }

function groupsWithLibs(board, size, color, n) {
  return E.groups(board, size, color).filter(g => g.libs.length === n);
}
function canMakeTwoEyes(board, size, mark, defender) {
  const mi = E.idx(mark[0], mark[1], size);
  const g = E.groupInfo(board, size, mi);
  const cands = new Set();
  g.stones.forEach(s => E.neighbors(s, size).forEach(n => { if (board[n] === 0) cands.add(n); }));
  for (const p of cands) {
    const r = E.play(board, size, p, defender, null);
    if (!r.ok) continue;
    if (E.countEyes(r.board, size, mi, defender) >= 2) return true;
  }
  return false;
}

function checkQuiz(l, q, i) {
  const tag = `${l.id} Q${i + 1} (${q.type})`;
  const size = 9;
  const board = E.boardFromSpec({ size, b: q.b, w: q.w });
  const me = moverOf(q), opp = defenderOf(q);

  // 原始局面不能有没气的子
  E.groups(board, size, B).forEach(g => { if (g.libs.length === 0) err(`${tag}: 初始局面有没气的黑棋`); });
  E.groups(board, size, W).forEach(g => { if (g.libs.length === 0) err(`${tag}: 初始局面有没气的白棋`); });

  switch (q.type) {
    case 'choice': {
      const ok = (q.options || []).filter(o => o.ok).length;
      if (ok !== 1) err(`${tag}: 选择题正确答案不是 1 个（${ok}）`);
      break;
    }
    case 'yesno': {
      if (typeof q.answer !== 'boolean') err(`${tag}: yesno 缺少 answer`);
      break;
    }
    case 'any': {
      if (E.legalMoves(board, size, me, null).length === 0) err(`${tag}: 没有可下的点`);
      break;
    }
    case 'pickPoint': {
      const ans = q.answers || [];
      if (!ans.length) err(`${tag}: 缺少 answers`);
      ans.forEach(p => {
        const pi = E.idx(p[0], p[1], size);
        if (board[pi] !== 0) err(`${tag}: 答案点 ${p} 上有子`);
      });
      if (q.need && q.need > ans.length) err(`${tag}: need=${q.need} 大于答案数`);
      break;
    }
    case 'pickStone': {
      const hit = E.groups(board, size, q.color === 'W' ? W : B).filter(g => g.libs.length === q.libs);
      if (hit.length === 0) err(`${tag}: 没有气数=${q.libs} 的子`);
      break;
    }
    case 'libPoint': {
      const mi = E.idx(q.mark[0], q.mark[1], size);
      const g = E.groupInfo(board, size, mi);
      if (g.color === 0) err(`${tag}: mark 处没有子`);
      if (g.libs.length === 0) err(`${tag}: mark 的棋块没有气`);
      break;
    }
    case 'eyePoint': {
      const color = q.color === 'W' ? W : B;
      let eyes = [];
      for (let p = 0; p < board.length; p++) if (board[p] === 0 && E.isEye(board, size, p, color)) eyes.push(p);
      if (eyes.length === 0) err(`${tag}: 局面里找不到眼`);
      if (q.need && eyes.length < q.need) err(`${tag}: 眼的数量 ${eyes.length} < need ${q.need}`);
      break;
    }
    case 'capture':
    case 'atari':
    case 'doubleAtari':
    case 'escape':
    case 'connect':
    case 'cut':
    case 'live':
    case 'kill': {
      let sols = [];
      for (let p = 0; p < board.length; p++) {
        if (board[p] !== 0) continue;
        const r = E.play(board, size, p, me, null);
        if (!r.ok) continue;
        const nb = r.board;
        let good = false;
        if (q.type === 'capture') good = r.captured.length >= (q.min || 1);
        else if (q.type === 'atari') good = groupsWithLibs(nb, size, opp, 1).length >= 1;
        else if (q.type === 'doubleAtari') good = groupsWithLibs(nb, size, opp, 1).length >= 2;
        else if (q.type === 'escape') {
          const mi = E.idx(q.mark[0], q.mark[1], size);
          good = E.groupInfo(nb, size, mi).libs.length >= 2;
        } else if (q.type === 'connect') {
          const a = E.idx(q.marks[0][0], q.marks[0][1], size), b2 = E.idx(q.marks[1][0], q.marks[1][1], size);
          good = E.sameGroup(nb, size, a, b2);
        } else if (q.type === 'cut') {
          const a = E.idx(q.marks[0][0], q.marks[0][1], size), b2 = E.idx(q.marks[1][0], q.marks[1][1], size);
          const ga = E.groupInfo(board, size, a), gb = E.groupInfo(board, size, b2);
          const adjA = ga.stones.some(s => E.neighbors(s, size).includes(p));
          const adjB = gb.stones.some(s => E.neighbors(s, size).includes(p));
          good = adjA && adjB && !E.sameGroup(nb, size, a, b2);
        } else if (q.type === 'live') {
          const mi = E.idx(q.mark[0], q.mark[1], size);
          good = E.countEyes(nb, size, mi, me) >= 2;
        } else if (q.type === 'kill') {
          good = !canMakeTwoEyes(nb, size, q.mark, opp);
        }
        if (good) sols.push(p);
      }
      if (q.type === 'kill' && !canMakeTwoEyes(board, size, q.mark, opp)) {
        warn(`${tag}: 初始状态对方已经做不出两只眼，题目意义不大`);
      }
      if (q.type === 'escape') {
        const mi = E.idx(q.mark[0], q.mark[1], size);
        if (E.groupInfo(board, size, mi).libs.length !== 1) warn(`${tag}: mark 的棋块初始不是 1 口气`);
      }
      if (q.type === 'connect' && E.sameGroup(board, size, E.idx(q.marks[0][0], q.marks[0][1], size), E.idx(q.marks[1][0], q.marks[1][1], size))) {
        err(`${tag}: 两块棋一开始就是连着的`);
      }
      if (q.type === 'cut' && !E.sameGroup(board, size, E.idx(q.marks[0][0], q.marks[0][1], size), E.idx(q.marks[1][0], q.marks[1][1], size))) {
        warn(`${tag}: 两个标记本来就不相连（属于"不让对方连上"型，可接受）`);
      }
      if (sols.length === 0) err(`${tag}: 无解！`);
      if (q.type === 'live' || q.type === 'kill' || q.type === 'cut' || q.type === 'connect') {
        if (sols.length > 4) warn(`${tag}: 有 ${sols.length} 个解，可能太松`);
      }
      break;
    }
    case 'forbid': {
      const pi = E.idx(q.point[0], q.point[1], size);
      if (board[pi] !== 0) err(`${tag}: ★ 点上有子`);
      const leg = E.isLegal(board, size, pi, me, null);
      if (q.expect !== undefined && leg.ok !== q.expect) {
        err(`${tag}: ★ 实际${leg.ok ? '能下' : '不能下'}(${leg.reason})，与 expect=${q.expect} 不符`);
      }
      if (leg.ok && leg.reason === null && q.type === 'forbid' && !leg.captured.length) {
        // 能下且没提子：确认不是无意义的题
      }
      break;
    }
    case 'answers': {
      const ans = q.answers || [];
      if (!ans.length) err(`${tag}: 缺少 answers`);
      ans.forEach(a => {
        const pi = E.idx(a[0], a[1], size);
        const leg = E.isLegal(board, size, pi, me, null);
        if (!leg.ok) err(`${tag}: 答案 ${a} 不合法 (${leg.reason})`);
        else if (q.check) {
          const r = E.play(board, size, pi, me, null);
          if (q.check === 'atari' && groupsWithLibs(r.board, size, opp, 1).length < 1) err(`${tag}: 答案 ${a} 不满足 atari`);
          if (q.check === 'capture' && r.captured.length < 1) err(`${tag}: 答案 ${a} 不能提子`);
        }
      });
      break;
    }
    default:
      err(`${tag}: 未知题型 ${q.type}`);
  }
}

function checkDemo(l, d, i) {
  const tag = `${l.id} demo${i + 1}`;
  const size = 9;
  let board = E.boardFromSpec({ size, b: d.b, w: d.w });
  let ko = null;
  (d.moves || []).forEach((m, k) => {
    const color = m[0] === 'W' ? W : B;
    const pi = E.idx(m[1], m[2], size);
    const r = E.play(board, size, pi, color, ko);
    if (!r.ok) err(`${tag} 第 ${k + 1} 手 ${m[0]}(${m[1]},${m[2]}) 不合法: ${r.reason}`);
    else { board = r.board; ko = r.koPoint; }
  });
  if (d.mark) {
    d.mark.forEach(p => {
      if (p[0] < 0 || p[0] >= size || p[1] < 0 || p[1] >= size) err(`${tag}: mark ${p} 越界`);
    });
  }
}

C.forEach(l => {
  (l.demos || []).forEach(checkDemo.bind(null, l));
  (l.quiz || []).forEach(checkQuiz.bind(null, l));
  if (!l.tip || !l.tip.say) err(`${l.id}: 缺少家长陪学提示`);
});

console.log(`课程 ${C.length} 课`);
console.log(`错误 ${errors.length} 条，提醒 ${warns.length} 条`);
errors.forEach(e => console.log('  [ERR] ' + e));
warns.forEach(w => console.log('  [warn] ' + w));
process.exit(errors.length ? 1 : 0);
