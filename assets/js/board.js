/* SVG 棋盘组件：超大格子、点击落子、拖拽落子、气点显示、提子动画、标记（★眼/禁入点/地盘） */
(function (global) {
  'use strict';
  var E = global.WQEngine;

  function uid() { return 'wq' + Math.random().toString(36).slice(2, 8); }

  function Board(container, opts) {
    opts = opts || {};
    var self = {};
    var size = opts.size || 9;
    var unit = 100, pad = 62, span = (size - 1) * unit;
    var state = {
      size: size,
      board: new Array(size * size).fill(0),
      marks: [],
      last: null,
      showLibs: false,
      interactive: !!opts.interactive,
      turn: E.BLACK,
      ko: null
    };
    var svgNS = 'http://www.w3.org/2000/svg';
    var gid = uid();
    var capturedAnim = [];

    function stars() {
      if (size === 9) return [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
      if (size === 7) return [[2, 2], [2, 4], [4, 2], [4, 4]];
      return [];
    }
    function cx(c) { return c * unit; }
    function cy(r) { return r * unit; }

    function stoneDefs() {
      return '' +
        '<defs>' +
        '<radialGradient id="blk' + gid + '" cx="35%" cy="30%" r="75%">' +
        '<stop offset="0%" stop-color="#7c7671"/><stop offset="70%" stop-color="#2f2b28"/></radialGradient>' +
        '<radialGradient id="wht' + gid + '" cx="35%" cy="30%" r="75%">' +
        '<stop offset="0%" stop-color="#ffffff"/><stop offset="75%" stop-color="#efe6d8"/></radialGradient>' +
        '</defs>';
    }

    function render() {
      var b = state.board, i, r, c, out = [];
      out.push('<svg class="board-svg" viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (span + pad * 2) + ' ' + (span + pad * 2) + '" xmlns="' + svgNS + '">');
      out.push(stoneDefs());
      // 线
      out.push('<g stroke="' + getComputedStyle(document.body).getPropertyValue('--wood-line').trim() + '" stroke-width="3" stroke-linecap="round">');
      for (i = 0; i < size; i++) {
        out.push('<line x1="' + cx(0) + '" y1="' + cy(i) + '" x2="' + cx(size - 1) + '" y2="' + cy(i) + '"/>');
        out.push('<line x1="' + cx(i) + '" y1="' + cy(0) + '" x2="' + cx(i) + '" y2="' + cy(size - 1) + '"/>');
      }
      out.push('</g>');
      // 星位
      out.push('<g fill="#8a5a1e">');
      stars().forEach(function (p) { out.push('<circle cx="' + cx(p[1]) + '" cy="' + cy(p[0]) + '" r="9"/>'); });
      out.push('</g>');
      // 地盘标记
      state.marks.forEach(function (m) {
        var y = cy(m.p[0]), x = cx(m.p[1]);
        if (m.type === 'area') out.push('<rect x="' + (x - 44) + '" y="' + (y - 44) + '" width="88" height="88" rx="10" fill="#35a06a" opacity="0.28"/>');
      });
      // 气点
      if (state.showLibs) {
        var done = {};
        for (i = 0; i < b.length; i++) {
          if (!b[i]) continue;
          var g = E.groupInfo(b, size, i);
          var key = g.stones.join(',');
          if (done[key]) { continue; }
          done[key] = 1;
          g.libs.forEach(function (li) {
            var rc = E.rc(li, size);
            out.push('<circle class="lib-dot" cx="' + cx(rc[1]) + '" cy="' + cy(rc[0]) + '" r="13" fill="' + (g.color === E.BLACK ? '#ff8b3d' : '#3d8bfd') + '" opacity="0.85"/>');
          });
        }
      }
      // 棋子
      for (i = 0; i < b.length; i++) {
        if (!b[i]) continue;
        var rr = Math.floor(i / size), cc = i % size;
        var isNew = (i === state.last && !capturedAnim.length);
        var cls = isNew ? ' class="stone-new" style="transform-origin:' + cx(cc) + 'px ' + cy(rr) + 'px"' : '';
        var fill = b[i] === E.BLACK ? 'url(#blk' + gid + ')' : 'url(#wht' + gid + ')';
        var stroke = b[i] === E.BLACK ? '#1e1b19' : '#c9bba6';
        var gone = capturedAnim.indexOf(i) >= 0;
        out.push('<g' + (gone ? ' class="captured" style="opacity:0;transform:translate(' + cx(cc) + 'px,' + (cy(rr) - 60) + 'px)"' : cls) + '>');
        out.push('<circle cx="' + cx(cc) + '" cy="' + cy(rr) + '" r="46" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2"/>');
        out.push('</g>');
      }
      // 标记 ★
      state.marks.forEach(function (m) {
        if (m.type === 'area') return;
        var y = cy(m.p[0]), x = cx(m.p[1]);
        var color = m.type === 'forbid' ? '#e8543f' : (m.type === 'eye' ? '#3d8bfd' : (m.type === 'ok' ? '#35a06a' : '#ffb703'));
        out.push('<text x="' + x + '" y="' + y + '" text-anchor="middle" dominant-baseline="central" font-size="52" fill="' + color + '" stroke="#fff" stroke-width="3">★</text>');
      });
      // 最后一手
      if (state.last != null && state.board[state.last]) {
        var lr = Math.floor(state.last / size), lc = state.last % size;
        out.push('<circle cx="' + cx(lc) + '" cy="' + cy(lr) + '" r="46" fill="none" stroke="#ff8b3d" stroke-width="6" opacity="0.9"/>');
      }
      // 点击热区
      if (state.interactive) {
        out.push('<g fill="transparent">');
        for (i = 0; i < b.length; i++) {
          var hr = Math.floor(i / size), hc = i % size;
          out.push('<circle data-i="' + i + '" cx="' + cx(hc) + '" cy="' + cy(hr) + '" r="50" style="cursor:pointer"/>');
        }
        out.push('</g>');
      }
      out.push('</svg>');
      container.innerHTML = out.join('');
      var svg = container.querySelector('svg');
      if (state.interactive) {
        svg.addEventListener('click', function (ev) {
          var t = ev.target;
          if (t && t.getAttribute && t.getAttribute('data-i') != null) {
            var idx = parseInt(t.getAttribute('data-i'), 10);
            if (self.onPoint) self.onPoint(idx, 'click');
          }
        });
      }
      // 拖拽落子
      container.addEventListener('dragover', function (ev) { ev.preventDefault(); });
      container.addEventListener('drop', function (ev) {
        ev.preventDefault();
        var color = ev.dataTransfer.getData('text/plain');
        var pt = pointFromEvent(ev);
        if (pt != null && self.onPoint) self.onPoint(pt, 'drag', color);
      });
      self.svg = svg;
      return svg;
    }

    function pointFromEvent(ev) {
      var svg = container.querySelector('svg');
      if (!svg || !svg.getScreenCTM) return null;
      var pt = svg.createSVGPoint ? svg.createSVGPoint() : null;
      if (!pt) return null;
      pt.x = ev.clientX; pt.y = ev.clientY;
      var loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      var c = Math.round(loc.x / unit), r = Math.round(loc.y / unit);
      if (r < 0 || r >= size || c < 0 || c >= size) return null;
      var dr = Math.abs(loc.x / unit - c), dc = Math.abs(loc.y / unit - r);
      if (dr > 0.42 || dc > 0.42) return null;
      return E.idx(r, c, size);
    }

    /* ---- 对外接口 ---- */
    self.state = state;
    self.load = function (st) {
      if (st.size) size = st.size;
      state.size = size;
      span = (size - 1) * unit;
      state.board = (st.board ? st.board.slice() : new Array(size * size).fill(0));
      state.marks = st.marks || [];
      state.last = st.last != null ? st.last : null;
      state.showLibs = !!st.showLibs;
      state.interactive = st.interactive != null ? st.interactive : state.interactive;
      state.turn = st.turn || state.turn;
      state.ko = st.ko || null;
      capturedAnim = [];
      render();
      return self;
    };
    self.fromSpec = function (spec, extra) {
      var b = E.boardFromSpec({ size: spec.size || 9, b: spec.b, w: spec.w });
      var st = { size: spec.size || 9, board: b, marks: spec.marks || [], showLibs: !!spec.showLibs };
      if (extra) for (var k in extra) st[k] = extra[k];
      return self.load(st);
    };
    self.board = function () { return state.board; };
    self.size = function () { return size; };
    self.setMarks = function (marks) { state.marks = marks || []; render(); return self; };
    self.setShowLibs = function (v) { state.showLibs = !!v; render(); return self; };
    self.setTurn = function (c) { state.turn = c; return self; };
    self.setInteractive = function (v) { state.interactive = !!v; render(); return self; };
    self.shake = function (idx) {
      var svg = container.querySelector('svg');
      var g = svg && svg.querySelectorAll('g');
      if (!g) return;
      var rr = Math.floor(idx / size), cc = idx % size;
      // 简单做法：整块抖一抖
      svg.classList.remove('shake'); void svg.offsetWidth; svg.classList.add('shake');
    };
    self.play = function (idx, color, cb) {
      var res = E.play(state.board, size, idx, color, state.ko);
      if (!res.ok) { self.shake(idx); return res; }
      if (res.captured.length) {
        capturedAnim = res.captured.slice();
        state.last = idx;
        render();
        setTimeout(function () {
          state.board = res.board; capturedAnim = []; state.ko = res.koPoint;
          render(); if (cb) cb(res);
        }, 260);
      } else {
        state.board = res.board; state.last = idx; state.ko = res.koPoint;
        render(); if (cb) cb(res);
      }
      return res;
    };
    self.render = render;
    return self;
  }

  global.WQBoard = { create: Board };
})(window);
