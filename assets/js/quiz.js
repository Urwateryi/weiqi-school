/* 闯关答题引擎：出题、判题（用规则引擎客观判定）、正反馈、错题记录 */
(function (global) {
  'use strict';
  var E = global.WQEngine, WQ = global.WQ;

  function moverOf(q) { return q.turn === 'W' ? E.WHITE : E.BLACK; }
  function opponent(c) { return c === E.BLACK ? E.WHITE : E.BLACK; }
  function groupsWithLibs(board, size, color, n) {
    return E.groups(board, size, color).filter(function (g) { return g.libs.length === n; });
  }
  function canMakeTwoEyes(board, size, mark, defender) {
    var mi = E.idx(mark[0], mark[1], size);
    var g = E.groupInfo(board, size, mi);
    var cands = {};
    g.stones.forEach(function (s) { E.neighbors(s, size).forEach(function (n) { if (board[n] === 0) cands[n] = 1; }); });
    for (var p in cands) {
      var r = E.play(board, size, parseInt(p, 10), defender, null);
      if (!r.ok) continue;
      if (E.countEyes(r.board, size, mi, defender) >= 2) return true;
    }
    return false;
  }

  /* 判断孩子点在某点是否正确（不改变棋盘，pick 类题型用） */
  function checkPoint(q, board, size, idx) {
    var color = q.color === 'W' ? E.WHITE : E.BLACK;
    switch (q.type) {
      case 'pickPoint':
        return (q.answers || []).some(function (a) { return E.idx(a[0], a[1], size) === idx; });
      case 'libPoint': {
        var mi = E.idx(q.mark[0], q.mark[1], size);
        var g = E.groupInfo(board, size, mi);
        return g.libs.indexOf(idx) >= 0;
      }
      case 'pickStone':
        return board[idx] === color && E.groupInfo(board, size, idx).libs.length === q.libs;
      case 'eyePoint':
        return board[idx] === 0 && E.isEye(board, size, idx, color);
      default:
        return false;
    }
  }

  /* 判断落子是否正确（落子类题型） */
  function checkMove(q, board, size, idx) {
    var me = moverOf(q), opp = opponent(me);
    var leg = E.isLegal(board, size, idx, me, null);
    if (!leg.ok) return { ok: false, msg: reasonText(leg.reason) };
    var r = E.play(board, size, idx, me, null);
    var nb = r.board;
    switch (q.type) {
      case 'any': return { ok: true, msg: '下得不错！' };
      case 'capture': return { ok: r.captured.length >= (q.min || 1), msg: r.captured.length ? '吃掉啦！' : '这一手吃不到子哦，再看看气在哪里' };
      case 'atari': return { ok: groupsWithLibs(nb, size, opp, 1).length >= 1, msg: '把它打到只剩一口气就对啦' };
      case 'doubleAtari': return { ok: groupsWithLibs(nb, size, opp, 1).length >= 2, msg: '要同时叫吃两块棋哦' };
      case 'escape': return { ok: E.groupInfo(nb, size, E.idx(q.mark[0], q.mark[1], size)).libs.length >= 2, msg: '要跑到气变多的地方' };
      case 'connect': return { ok: E.sameGroup(nb, size, E.idx(q.marks[0][0], q.marks[0][1], size), E.idx(q.marks[1][0], q.marks[1][1], size)), msg: '要把两块棋连成一块' };
      case 'cut': {
        var a = E.idx(q.marks[0][0], q.marks[0][1], size), b = E.idx(q.marks[1][0], q.marks[1][1], size);
        var ga = E.groupInfo(board, size, a), gb = E.groupInfo(board, size, b);
        var adjA = ga.stones.some(function (s) { return E.neighbors(s, size).indexOf(idx) >= 0; });
        var adjB = gb.stones.some(function (s) { return E.neighbors(s, size).indexOf(idx) >= 0; });
        var sep = !E.sameGroup(nb, size, a, b);
        return { ok: adjA && adjB && sep, msg: '要插在两块中间，不让它们连上' };
      }
      case 'live': return { ok: E.countEyes(nb, size, E.idx(q.mark[0], q.mark[1], size), me) >= 2, msg: '要做成两只眼才是活棋' };
      case 'kill': return { ok: !canMakeTwoEyes(nb, size, q.mark, opp), msg: '要抢先占住对方做眼的要点' };
      case 'answers': {
        var hit = (q.answers || []).some(function (a) { return E.idx(a[0], a[1], size) === idx; });
        if (!hit) return { ok: false, msg: '方向不对，再想一想' };
        if (q.check === 'atari' && groupsWithLibs(nb, size, opp, 1).length < 1) return { ok: false, msg: '这一手没有叫吃哦' };
        if (q.check === 'capture' && r.captured.length < 1) return { ok: false, msg: '这一手吃不到子' };
        return { ok: true, msg: '对啦！' };
      }
      default: return { ok: false, msg: '' };
    }
  }

  function reasonText(reason) {
    if (reason === 'occupied') return '这里已经有棋子啦';
    if (reason === 'suicide') return '这里是禁入点：下进去就没气了';
    if (reason === 'ko') return '打劫中，不能马上提回来，先去别处下一手';
    return '这里不能下哦';
  }

  /* 错因分析：孩子下错后，用引擎算出"刚才那手发生了什么"，给出针对性解释 */
  function analyzeWrong(q, board, size, idx) {
    var me = moverOf(q), opp = opponent(me);
    var parts = [];
    if (isPickType(q.type)) return analyzePickWrong(q, board, size, idx);
    var r = E.play(board, size, idx, me, null);
    if (!r.ok) return '';
    var gi = E.groupInfo(r.board, size, idx);
    if (gi.libs.length === 1) parts.push('你下的这手自己只剩 1 口气，反过来会被打吃哦');
    if (r.captured.length) parts.push('这一手吃到了 ' + r.captured.length + ' 颗子，不过题目要的不是这样吃');
    if (q.type === 'atari' || q.type === 'doubleAtari' || q.type === 'capture' || (q.type === 'answers' && q.check === 'atari')) {
      var seen = {};
      E.neighbors(idx, size).forEach(function (n) {
        if (board[n] === opp && !seen[n]) {
          var g = E.groupInfo(board, size, n);
          g.stones.forEach(function (s) { seen[s] = 1; });
          parts.push('那块白棋下完后还剩 ' + g.libs.length + ' 口气，要打到只剩 1 口才行');
        }
      });
    }
    if (q.type === 'escape') parts.push('要下在被围的黑棋旁边，往空处长出去，气变多才算逃掉');
    if (q.type === 'connect') parts.push('要下在两块黑子中间的空点，让它们连成一家人');
    if (q.type === 'cut') parts.push('要插在两块白子中间，让它们连不上');
    if (q.type === 'live' || q.type === 'kill') parts.push('先找中间最关键的那一点，谁抢到谁赢');
    return parts.slice(0, 2).join('；');
  }
  function analyzePickWrong(q, board, size, idx) {
    if (q.type === 'pickStone') {
      if (board[idx] === 0) return '要点在棋子上，不是空点上哦';
      return '你点的这颗子有 ' + E.groupInfo(board, size, idx).libs.length + ' 口气，再数一数';
    }
    if (q.type === 'libPoint') return board[idx] !== 0 ? '气是空点，要点它旁边的空格' : '要紧挨着这颗棋的上下左右空格';
    if (q.type === 'eyePoint') return board[idx] !== 0 ? '眼是空点，要点空的地方' : '这里还没被围严实，不算眼';
    return '';
  }
  function isPickType(t) { return t === 'pickPoint' || t === 'libPoint' || t === 'pickStone' || t === 'eyePoint'; }

  /* 找出一个正解（用于"看答案"与自动测试） */
  function findSolution(q, size) {
    var board = E.boardFromSpec({ size: size, b: q.b, w: q.w });
    var me = moverOf(q);
    var i;
    if (q.type === 'pickStone') {
      var want = q.color === 'W' ? E.WHITE : E.BLACK;
      for (i = 0; i < board.length; i++) {
        if (board[i] === want && E.groupInfo(board, size, i).libs.length === q.libs) return i;
      }
      return null;
    }
    if (q.type === 'libPoint') {
      var gl = E.groupInfo(board, size, E.idx(q.mark[0], q.mark[1], size));
      return gl.libs.length ? gl.libs[0] : null;
    }
    if (q.type === 'eyePoint') {
      var ec = q.color === 'W' ? E.WHITE : E.BLACK;
      for (i = 0; i < board.length; i++) if (board[i] === 0 && E.isEye(board, size, i, ec)) return i;
      return null;
    }
    for (var i = 0; i < board.length; i++) {
      if (board[i] !== 0) continue;
      var res = checkMove(q, board, size, i);
      if (res.ok) return i;
    }
    if (q.type === 'pickPoint' && q.answers && q.answers.length) return E.idx(q.answers[0][0], q.answers[0][1], size);
    return null;
  }

  /* ---------- 挂载一节课的闯关 ---------- */
  function mount(container, opts) {
    var lesson = opts.lesson;
    var questions = opts.questions || lesson.quiz;
    var lessonId = lesson.id;
    var size = 9;
    var qi = 0, tries = 0, collected = [];
    var board = null, current = null;

    container.innerHTML = '';
    var el = document.createElement('div');
    el.innerHTML =
      '<div class="tipbar"><span class="mascot">\u{1F43C}</span><span class="q-text"></span></div>' +
      '<div class="board-box"><div class="q-board"></div></div>' +
      '<div class="tray"><div class="piece black" draggable="true">黑</div><div class="piece white" draggable="true">白</div></div>' +
      '<div class="btn-row"><button class="btn q-say">🔊 读题</button><button class="btn q-hint">💡 提示</button><button class="btn q-exp">📖 看讲解</button><button class="btn q-ans">👀 看答案</button></div>' +
      '<div class="q-explain" style="display:none;text-align:left;background:#fff7e6;border:2px dashed #f0b429;border-radius:14px;padding:12px 14px;margin-top:10px;font-size:16px;line-height:1.7;color:#4a3520"></div>' +
      '<div class="q-extra"></div>' +
      '<p class="muted q-status"></p>';
    container.appendChild(el);

    var elText = el.querySelector('.q-text');
    var elStatus = el.querySelector('.q-status');
    var elExtra = el.querySelector('.q-extra');
    var elBoard = el.querySelector('.q-board');
    var tipbar = el.querySelector('.tipbar');

    board = global.WQBoard.create(elBoard, { size: size, interactive: true });

    el.querySelector('.q-say').onclick = function () { WQ.speak(current ? current.prompt : ''); };
    el.querySelector('.q-hint').onclick = function () {
      if (!current) return;
      say(current.hint ? '💡 ' + current.hint : '再想一想：看看棋子的气在哪里', 'bad');
    };
    el.querySelector('.q-ans').onclick = function () {
      if (!current) return;
      var s = findSolution(current, size);
      if (s == null) { say('这题点下面的按钮回答就好', 'bad'); return; }
      if (isPick(current)) {
        board.setMarks([{ p: E.rc(s, size), type: 'ok' }]);
      } else {
        var tmp = board.board().slice();
        tmp[s] = moverOf(current);
        board.load({ board: tmp, marks: [{ p: E.rc(s, size), type: 'ok' }] });
      }
      say('看看这里 ★ 就是答案，下一题你一定能自己想出来！', 'bad');
    };

    var elExplain = el.querySelector('.q-explain');
    function getExplain(q) {
      var lid = q.__lessonId || lessonId;
      return q.explain || ((global.WQ_EXPLAIN || {})[lid + '-' + (q.__index != null ? q.__index : qi)]) || '';
    }
    function showExplain(extra) {
      var q = current;
      if (!q) return;
      var txt = getExplain(q);
      if (extra) extra = '<p style="margin:6px 0 0"><b>🧐 你刚才那手棋：</b>' + extra + '</p>';
      elExplain.innerHTML = (txt ? '<b>📖 讲解：</b>' + txt : '<b>📖 讲解：</b>这道题先自己想一想，做出来再看更有收获。') + (extra || '');
      elExplain.style.display = '';
    }
    el.querySelector('.q-exp').onclick = function () {
      if (!current) return;
      if (elExplain.style.display === 'none') showExplain('');
      else elExplain.style.display = 'none';
    };

    function isPick(q) {
      return q.type === 'pickPoint' || q.type === 'libPoint' || q.type === 'pickStone' || q.type === 'eyePoint';
    }
    function say(msg, kind) {
      elText.textContent = msg;
      tipbar.className = 'tipbar' + (kind ? ' ' + kind : '');
    }

    function showQuestion() {
      current = questions[qi];
      tries = 0; collected = [];
      var q = current;
      elExtra.innerHTML = '';
      elExplain.style.display = 'none';
      var spec = { size: size, b: q.b, w: q.w };
      var marks = [];
      if (q.type === 'forbid') marks.push({ p: q.point, type: 'forbid' });
      if (q.marks) q.marks.forEach(function (m) { marks.push({ p: m, type: 'star' }); });
      if (q.mark && q.type !== 'libPoint') marks.push({ p: q.mark, type: 'star' });
      board.fromSpec(spec, { marks: marks, interactive: !isButton(q), showLibs: q.showLibs || (q.type === 'libPoint' || q.type === 'pickStone') });
      board.setTurn(moverOf(q));
      say(q.prompt, '');
      var noBoard = isButton(q) && !(q.b && q.b.length) && !(q.w && q.w.length);
      el.querySelector('.board-box').style.display = noBoard ? 'none' : '';
      el.querySelector('.tray').style.display = isButton(q) ? 'none' : '';

      var opts2 = null;
      if (q.type === 'choice') opts2 = q.options;
      else if (q.type === 'yesno') opts2 = [
        { t: q.yesText || '对', ok: q.answer === true },
        { t: q.noText || '不对', ok: q.answer === false }
      ];
      else if (q.type === 'forbid') {
        var pi = E.idx(q.point[0], q.point[1], size);
        var legal = E.isLegal(board.board(), size, pi, moverOf(q), null).ok;
        opts2 = [
          { t: '能下', ok: legal },
          { t: '不能下', ok: !legal }
        ];
      }
      if (opts2) {
        opts2.forEach(function (o) {
          var b = document.createElement('button');
          b.className = 'btn btn-big btn-primary';
          b.style.marginTop = '8px';
          b.textContent = o.t;
          b.onclick = function () {
            onAnswer(!!o.ok, o.ok ? '答对啦！' : (q.type === 'forbid' ? '再数一数：下进去还有气吗？能不能吃到子？' : '再想一想哦'));
          };
          elExtra.appendChild(b);
        });
      }
      updateStatus();
    }

    function isButton(q) { return q.type === 'choice' || q.type === 'yesno' || q.type === 'forbid'; }

    function updateStatus() {
      var lid = (current && current.__lessonId) || lessonId;
      var stars = WQ.Progress.stars(lid).map(function (v) { return v ? '⭐' : '☆'; }).join('');
      elStatus.textContent = '第 ' + (qi + 1) + ' / ' + questions.length + ' 题　·　星星：' + stars;
    }

    function onAnswer(ok, msg, analysis) {
      var q = current;
      var lid = q.__lessonId || lessonId;
      var qid = WQ.qid(lid, q.__index != null ? q.__index : qi);
      if (ok) {
        WQ.Sound.good();
        WQ.Fx.flyStar(window.innerWidth / 2, window.innerHeight / 2);
        WQ.Progress.setStar(lid, q.__index != null ? q.__index : qi);
        WQ.Progress.clearWrong(qid);
        say('🎉 ' + (msg || '太棒了！'), 'good');
        updateStatus();
        if (window.navigator.vibrate) { try { window.navigator.vibrate(30); } catch (e) {} }
        setTimeout(next, 900);
      } else {
        WQ.Sound.bad();
        tries++;
        WQ.Progress.markWrong(qid);
        var extra = analysis ? ' ' + analysis : '';
        var tail = '';
        if (tries >= 2) {
          tail = getExplain(q) ? '　点"📖 看讲解"看看为什么吧' : (q.hint ? '（提示：' + q.hint + '）' : '');
        }
        say('🤔 ' + msg + extra + tail, 'bad');
        showExplain(analysis);
        board.shake(0);
      }
    }

    function next() {
      qi++;
      if (qi >= questions.length) {
        board.setInteractive(false);
        say('这一课的三道题都做完啦！去下一课继续闯关吧 🎈', 'good');
        WQ.Sound.cheer();
        WQ.Fx.confetti();
        if (opts.onFinish) opts.onFinish();
        return;
      }
      showQuestion();
    }

    board.onPoint = function (idx, how, dragColor) {
      if (!current) return;
      var q = current;
      var b = board.board();
      if (isPick(q)) {
        if (checkPoint(q, b, size, idx)) {
          if (q.need && q.need > 1) {
            if (collected.indexOf(idx) >= 0) return;
            collected.push(idx);
            board.setMarks(board.state.marks.concat([{ p: E.rc(idx, size), type: 'eye' }]));
            WQ.Sound.place();
            if (collected.length >= q.need) onAnswer(true, '两只眼都找到了！');
            else say('找对了一个，还差 ' + (q.need - collected.length) + ' 个', 'good');
          } else {
            board.setMarks(board.state.marks.concat([{ p: E.rc(idx, size), type: 'ok' }]));
            onAnswer(true, '就是这里！');
          }
        } else {
          onAnswer(false, '不是这里哦，再找找', analyzePickWrong(q, b, size, idx));
        }
        return;
      }
      var color = dragColor === 'W' ? E.WHITE : (dragColor === 'B' ? E.BLACK : moverOf(q));
      var res = checkMove(q, b, size, idx);
      if (res.ok) {
        WQ.Sound.place();
        var r = board.play(idx, color);
        if (r && r.ok) {
          if (r.captured && r.captured.length) WQ.Sound.capture();
          setTimeout(function () { onAnswer(true, res.msg); }, 300);
        } else {
          onAnswer(true, res.msg);
        }
      } else {
        onAnswer(false, res.msg, analyzeWrong(q, b, size, idx));
      }
    };

    /* 拖拽 */
    var pieces = el.querySelectorAll('.tray .piece');
    Array.prototype.forEach.call(pieces, function (p) {
      var color = p.classList.contains('black') ? 'B' : 'W';
      p.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/plain', color); });
    });

    /* 题目带原始序号，保证星星与错题对应 */
    questions = questions.map(function (q, i) {
      var c = Object.create(q);
      c.__index = q.__index != null ? q.__index : i;
      return c;
    });

    showQuestion();
    return { next: next, restart: function () { qi = 0; showQuestion(); } };
  }

  global.WQQuiz = { mount: mount, checkMove: checkMove, checkPoint: checkPoint, findSolution: findSolution, analyzeWrong: analyzeWrong };
})(window);
