/* 公共：进度存储（localStorage）、音效、导航外壳、反馈动画、读题语音 */
(function (global) {
  'use strict';
  var KEY = 'weiqi-kids-progress-v1';
  var KEY_SOUND = 'weiqi-kids-sound';

  /* ---------- 进度 ---------- */
  var Progress = {
    data: null,
    load: function () {
      if (this.data) return this.data;
      var d = null;
      try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
      if (!d || d.v !== 1) d = { v: 1, stars: {}, wrong: {}, last: '', visits: 0 };
      this.data = d;
      return d;
    },
    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {}
    },
    stars: function (lessonId) {
      var s = this.load().stars[lessonId] || [false, false, false];
      return s;
    },
    starCount: function (lessonId) {
      return this.stars(lessonId).filter(Boolean).length;
    },
    totalStars: function () {
      var d = this.load(), n = 0;
      for (var k in d.stars) n += (d.stars[k] || []).filter(Boolean).length;
      return n;
    },
    setStar: function (lessonId, levelIdx) {
      var d = this.load();
      var s = d.stars[lessonId] || [false, false, false];
      s[levelIdx] = true;
      d.stars[lessonId] = s;
      d.last = lessonId;
      this.save();
    },
    isDone: function (lessonId) { return this.starCount(lessonId) >= 3; },
    doneCount: function (lessons) {
      var n = 0, self = this;
      (lessons || []).forEach(function (l) { if (self.isDone(l.id)) n++; });
      return n;
    },
    wrongList: function () {
      var d = this.load(), out = [];
      for (var k in d.wrong) if (d.wrong[k] > 0) out.push({ id: k, count: d.wrong[k] });
      return out.sort(function (a, b) { return b.count - a.count; });
    },
    markWrong: function (qid) {
      var d = this.load();
      d.wrong[qid] = (d.wrong[qid] || 0) + 1;
      this.save();
    },
    clearWrong: function (qid) {
      var d = this.load();
      d.wrong[qid] = Math.max(0, (d.wrong[qid] || 0) - 1);
      if (d.wrong[qid] <= 0) delete d.wrong[qid];
      this.save();
    },
    setLast: function (id) { var d = this.load(); d.last = id; this.save(); },
    reset: function () {
      this.data = { v: 1, stars: {}, wrong: {}, last: '', visits: 0 };
      this.save();
    }
  };

  /* ---------- 音效（Web Audio 合成，不依赖音频文件） ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var Sound = {
    ctx: null,
    on: function () { return lsGet(KEY_SOUND) !== 'off'; },
    toggle: function () {
      lsSet(KEY_SOUND, this.on() ? 'off' : 'on');
      return this.on();
    },
    ac: function () {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
      }
      return this.ctx;
    },
    tone: function (freq, dur, type, gain, delay) {
      if (!this.on()) return;
      var ac = this.ac(); if (!ac) return;
      var t0 = ac.currentTime + (delay || 0);
      var osc = ac.createOscillator(), g = ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    },
    place: function () { this.tone(320, 0.09, 'triangle', 0.16); },
    capture: function () { this.tone(880, 0.16, 'sine', 0.2); this.tone(1320, 0.2, 'sine', 0.12, 0.06); },
    good: function () {[523, 659, 784].forEach(function (f, i) { Sound.tone(f, 0.16, 'sine', 0.16, i * 0.09); }); },
    bad: function () { this.tone(220, 0.18, 'sine', 0.12); },
    cheer: function () {[523, 659, 784, 1046].forEach(function (f, i) { Sound.tone(f, 0.22, 'triangle', 0.16, i * 0.1); }); }
  };

  /* ---------- 反馈动画 ---------- */
  var Fx = {
    flyStar: function (x, y) {
      var el = document.createElement('div');
      el.className = 'fly-star';
      el.textContent = '⭐';
      el.style.left = (x - 20) + 'px';
      el.style.top = (y - 20) + 'px';
      document.body.appendChild(el);
      setTimeout(function () { el.remove(); }, 1000);
    },
    confetti: function () {
      var box = document.createElement('div');
      box.className = 'confetti';
      var colors = ['#ff8b3d', '#35a06a', '#3d8bfd', '#ffb703', '#e8543f', '#8a6bd8'];
      for (var i = 0; i < 40; i++) {
        var s = document.createElement('i');
        s.style.background = colors[i % colors.length];
        s.style.left = (Math.random() * 100) + '%';
        s.style.animationDelay = (Math.random() * 0.5) + 's';
        box.appendChild(s);
      }
      document.body.appendChild(box);
      setTimeout(function () { box.remove(); }, 2200);
    }
  };

  /* ---------- 语音（朗读）：开关 + 语速 + 自动挑中文音色 ---------- */
  var KEY_VOICE = 'weiqi-kids-voice';
  var KEY_RATE = 'weiqi-kids-voice-rate';
  /* 表扬语随机取，避免每次都一样（孩子会更来劲） */
  var PRAISE = ['答对啦，好厉害！', '太棒了，星星送你！', '全对！你是小棋士！', '赞！这一手真聪明！', '厉害啊，继续加油！'];
  var ENCOURAGE = ['再试一次，你可以的！', '差一点点，再想一想哦。', '没关系，我们再来！'];

  var Voice = {
    supported: function () { return typeof window !== 'undefined' && 'speechSynthesis' in window; },
    on: function () { return lsGet(KEY_VOICE) !== 'off'; },
    toggle: function () { lsSet(KEY_VOICE, this.on() ? 'off' : 'on'); return this.on(); },
    rate: function () { return parseFloat(lsGet(KEY_RATE)) || 0.85; },
    setRate: function (r) { lsSet(KEY_RATE, String(r)); },
    /* 优先挑选中文女声（不同系统名字不同），挑不到就用默认中文语音 */
    pick: function () {
      if (!this.supported()) return null;
      var vs = window.speechSynthesis.getVoices() || [];
      if (!vs.length) return null;
      var zh = vs.filter(function (v) { return (v.lang || '').toLowerCase().indexOf('zh') === 0; });
      if (!zh.length) return null;
      var nice = ['tingting', 'ting-ting', 'yaoyao', 'xiaoxiao', 'meijia', 'sinji', 'huihui', 'female'];
      for (var i = 0; i < nice.length; i++) {
        for (var j = 0; j < zh.length; j++) {
          if ((zh[j].name || '').toLowerCase().indexOf(nice[i]) >= 0) return zh[j];
        }
      }
      return zh[0];
    },
    stop: function () { if (this.supported()) { try { window.speechSynthesis.cancel(); } catch (e) {} } this.mark(0); },
    mark: function (secs) {
      var el = document.querySelector('.tipbar');
      if (!el) return;
      if (!secs) { el.classList.remove('talking'); return; }
      el.classList.add('talking');
      if (this._t) clearTimeout(this._t);
      this._t = setTimeout(function () { el.classList.remove('talking'); }, Math.max(700, secs * 1000));
    },
    /* 朗读文本；opts.force=true 时忽略开关（用于设置页试听） */
    say: function (text, opts) {
      opts = opts || {};
      if (!text) return;
      if (!this.supported()) return;
      if (!opts.force && !this.on()) return;
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(String(text));
        var v = this.pick();
        if (v) u.voice = v;
        u.lang = (v && v.lang) || 'zh-CN';
        u.rate = opts.rate || this.rate();
        u.pitch = 1.08;
        var self = this;
        u.onend = function () { self.mark(0); };
        window.speechSynthesis.speak(u);
        /* 吉祥物动起来：按字数估算时长 */
        if (opts.mark !== false) this.mark(Math.min(9, String(text).length / 4.2));
      } catch (e) {}
    },
    praise: function () { this.say(PRAISE[Math.floor(Math.random() * PRAISE.length)]); },
    encourage: function () { this.say(ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)]); }
  };

  function speak(text, opts) { Voice.say(text, opts); }

  /* ---------- 导航外壳 ---------- */
  var NAV = [
    { href: 'index.html', t: '首页', k: 'home' },
    { href: 'textbook/index.html', t: '教材', k: 'textbook' },
    { href: 'training/index.html', t: '训练', k: 'training' },
    { href: 'exercises/index.html', t: '练习', k: 'exercises' },
    { href: 'tricks/index.html', t: '妙招', k: 'tricks' },
    { href: 'parents/index.html', t: '家长', k: 'parents' },
    { href: 'progress/index.html', t: '进度', k: 'progress' }
  ];
  function base() {
    // 子目录页面需要 ../ 前缀
    var p = location.pathname;
    var seg = p.split('/').filter(Boolean);
    if (seg.length <= 1) return '';
    return '../';
  }
  function shell(active) {
    var b = base();
    var stars = Progress.totalStars();
    var host = document.getElementById('shell');
    if (!host) return;
    var html = '<div class="topbar"><div class="inner">' +
      '<a class="logo" href="' + b + 'index.html">小围棋<small>幼儿围棋陪学</small></a>' +
      '<button class="voice-chip" id="navVoice" title="朗读开关" style="margin-left:auto">🔊</button>' +
      '<span class="stars-badge">⭐ ' + stars + '</span>' +
      '</div></div><div class="navlist">';
    NAV.forEach(function (n) {
      html += '<a class="' + (n.k === active ? 'on' : '') + '" href="' + b + n.href + '">' + n.t + '</a>';
    });
    html += '</div>';
    host.innerHTML = html;
    /* 顶部朗读开关：任何页面都能一键开关语音 */
    var vb = host.querySelector('#navVoice');
    if (vb) {
      var sync = function () {
        var on = Voice.on();
        vb.textContent = on ? '🔊 朗读' : '🔇 静音';
        vb.className = 'voice-chip' + (on ? ' on' : '');
        if (!Voice.supported()) { vb.textContent = '🔇 无语音'; vb.className = 'voice-chip'; vb.disabled = true; }
      };
      vb.onclick = function () {
        Voice.toggle(); sync();
        Voice.say('朗读' + (Voice.on() ? '打开啦' : '关掉了'), { force: true });
      };
      sync();
    }
  }

  function param(name) {
    var m = location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  global.WQ = {
    Progress: Progress, Sound: Sound, Voice: Voice, Fx: Fx, speak: speak,
    praise: function () { Voice.praise(); }, encourage: function () { Voice.encourage(); },
    shell: shell, param: param, base: base,
    qid: function (lessonId, i) { return lessonId + '#' + i; },
    parseQid: function (qid) { var p = qid.split('#'); return { lessonId: p[0], index: parseInt(p[1], 10) }; }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var d = Progress.load();
    d.visits = (d.visits || 0) + 1;
    Progress.save();
    /* 防止拖拽棋子没落到棋盘上时，浏览器用拖拽数据跳转页面（看起来像"页面被刷新/跳走"） */
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });
  });
})(window);
