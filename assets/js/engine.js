/* 围棋规则引擎：气、提子、禁入点、打劫、眼。纯函数，浏览器与 Node 都能用。 */
(function (global) {
  'use strict';

  var EMPTY = 0, BLACK = 1, WHITE = 2;

  function idx(r, c, size) { return r * size + c; }
  function rc(i, size) { return [Math.floor(i / size), i % size]; }
  function makeBoard(size) { return new Array(size * size).fill(EMPTY); }
  function clone(b) { return b.slice(); }
  function other(c) { return c === BLACK ? WHITE : BLACK; }

  function neighbors(i, size) {
    var r = Math.floor(i / size), c = i % size, out = [];
    if (r > 0) out.push(i - size);
    if (r < size - 1) out.push(i + size);
    if (c > 0) out.push(i - 1);
    if (c < size - 1) out.push(i + 1);
    return out;
  }

  function diagonals(i, size) {
    var r = Math.floor(i / size), c = i % size, out = [];
    var d = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (var k = 0; k < d.length; k++) {
      var nr = r + d[k][0], nc = c + d[k][1];
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(idx(nr, nc, size));
    }
    return out;
  }

  /* 一块棋：stones 是棋子串，libs 是气的集合 */
  function groupInfo(board, size, i) {
    var color = board[i];
    if (!color) return { stones: [], libs: [], color: EMPTY };
    var seen = {}, stones = [], libs = {}, libList = [], stack = [i];
    seen[i] = 1;
    while (stack.length) {
      var cur = stack.pop();
      stones.push(cur);
      var ns = neighbors(cur, size);
      for (var k = 0; k < ns.length; k++) {
        var n = ns[k];
        if (board[n] === EMPTY) {
          if (!libs[n]) { libs[n] = 1; libList.push(n); }
        } else if (board[n] === color && !seen[n]) {
          seen[n] = 1; stack.push(n);
        }
      }
    }
    return { stones: stones, libs: libList, color: color };
  }

  function liberties(board, size, i) { return groupInfo(board, size, i).libs.length; }

  /* 若 color 下在 i，能提掉哪些对方子 */
  function capturesAt(board, size, i, color) {
    var opp = other(color), cap = {}, list = [];
    var ns = neighbors(i, size);
    for (var k = 0; k < ns.length; k++) {
      var n = ns[k];
      if (board[n] === opp) {
        var g = groupInfo(board, size, n);
        if (g.libs.length === 1) {
          for (var j = 0; j < g.stones.length; j++) {
            if (!cap[g.stones[j]]) { cap[g.stones[j]] = 1; list.push(g.stones[j]); }
          }
        }
      }
    }
    return list;
  }

  function isLegal(board, size, i, color, koPoint) {
    if (board[i] !== EMPTY) return { ok: false, reason: 'occupied', captured: [] };
    var cap = capturesAt(board, size, i, color);
    if (cap.length === 0) {
      board[i] = color;
      var g = groupInfo(board, size, i);
      board[i] = EMPTY;
      if (g.libs.length === 0) return { ok: false, reason: 'suicide', captured: [] };
    }
    if (koPoint != null && i === koPoint) return { ok: false, reason: 'ko', captured: cap };
    return { ok: true, reason: null, captured: cap };
  }

  function play(board, size, i, color, koPoint) {
    var leg = isLegal(board, size, i, color, koPoint);
    if (!leg.ok) return { ok: false, reason: leg.reason, board: board, captured: [], koPoint: koPoint };
    var nb = clone(board);
    nb[i] = color;
    for (var k = 0; k < leg.captured.length; k++) nb[leg.captured[k]] = EMPTY;
    var newKo = null;
    if (leg.captured.length === 1) {
      var g = groupInfo(nb, size, i);
      if (g.stones.length === 1 && g.libs.length === 1) newKo = leg.captured[0];
    }
    return { ok: true, reason: null, board: nb, captured: leg.captured, koPoint: newKo, move: i };
  }

  /* 简单眼位判断：四周（含边）都是己方子，且对角对方子不超过 1（边上为 0） */
  function isEye(board, size, i, color) {
    if (board[i] !== EMPTY) return false;
    var ns = neighbors(i, size);
    for (var k = 0; k < ns.length; k++) if (board[ns[k]] !== color) return false;
    var diag = diagonals(i, size);
    var opp = other(color), cnt = 0, offBoard = ns.length < 4;
    for (var j = 0; j < diag.length; j++) if (board[diag[j]] === opp) cnt++;
    return cnt <= (offBoard ? 0 : 1);
  }

  /* 某块棋有几个眼 */
  function countEyes(board, size, i, color) {
    var g = groupInfo(board, size, i);
    if (g.color !== color) return 0;
    var eyes = {}, n = 0;
    for (var a = 0; a < g.stones.length; a++) {
      var ns = neighbors(g.stones[a], size);
      for (var b = 0; b < ns.length; b++) {
        var p = ns[b];
        if (board[p] === EMPTY && !eyes[p] && isEye(board, size, p, color)) { eyes[p] = 1; n++; }
      }
    }
    return n;
  }

  function groups(board, size, color) {
    var seen = {}, out = [];
    for (var i = 0; i < board.length; i++) {
      if (board[i] === color && !seen[i]) {
        var g = groupInfo(board, size, i);
        for (var k = 0; k < g.stones.length; k++) seen[g.stones[k]] = 1;
        out.push(g);
      }
    }
    return out;
  }

  function sameGroup(board, size, a, b) {
    if (board[a] === EMPTY || board[a] !== board[b]) return false;
    var g = groupInfo(board, size, a);
    return g.stones.indexOf(b) >= 0;
  }

  function legalMoves(board, size, color, koPoint) {
    var out = [];
    for (var i = 0; i < board.length; i++) if (isLegal(board, size, i, color, koPoint).ok) out.push(i);
    return out;
  }

  /* 从 {size,b,w} 描述生成棋盘数组 */
  function boardFromSpec(spec) {
    var size = (spec && spec.size) || 9;
    var b = makeBoard(size);
    var put = function (list, color) {
      (list || []).forEach(function (p) { b[idx(p[0], p[1], size)] = color; });
    };
    put(spec && spec.b, BLACK);
    put(spec && spec.w, WHITE);
    return b;
  }

  var API = {
    EMPTY: EMPTY, BLACK: BLACK, WHITE: WHITE,
    idx: idx, rc: rc, makeBoard: makeBoard, clone: clone, other: other,
    neighbors: neighbors, diagonals: diagonals,
    groupInfo: groupInfo, liberties: liberties, capturesAt: capturesAt,
    isLegal: isLegal, play: play, isEye: isEye, countEyes: countEyes,
    groups: groups, sameGroup: sameGroup, legalMoves: legalMoves, boardFromSpec: boardFromSpec
  };

  global.WQEngine = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
