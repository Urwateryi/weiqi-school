/* 冒烟测试：用 jsdom 打开每个页面，检查脚本无报错、关键元素渲染出来，
   并自动把 20 课的 60 道题全部"答一遍"（用引擎找正解），确认判题逻辑与进度写入正常。
   用法：NODE_PATH=<workspace>/node_modules node tools/smoke.js */
'use strict';
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');

const pages = [
  'index.html', 'textbook/index.html', 'lesson/index.html?id=p01',
  'training/index.html', 'exercises/index.html', 'parents/index.html', 'progress/index.html'
];

const errors = [];
function load(file, query) {
  const abs = path.join(ROOT, file);
  return JSDOM.fromFile(abs, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    url: 'file://' + abs + (query ? '?' + query : '')
  });
}

(async function () {
  // 1) 各页面能否无错加载
  for (const p of pages) {
    const [file, query] = p.split('?');
    const dom = await load(file, query);
    const w = dom.window;
    await new Promise(r => setTimeout(r, 300));
    const navCount = w.document.querySelectorAll('.navlist a').length;
    if (navCount !== 6) errors.push(`${p}: 导航渲染异常 (${navCount})`);
    dom.window.close();
  }
  console.log('页面加载检查完成：' + pages.length + ' 个');

  // 2) 逐课自动答题
  const dom = await load('lesson/index.html', 'id=p01');
  const w = dom.window;
  await new Promise(r => setTimeout(r, 300));
  const C = w.WQ_CURRICULUM;
  const E = w.WQEngine;
  let solved = 0, failed = [];
  for (const lesson of C) {
    for (let i = 0; i < lesson.quiz.length; i++) {
      const q = lesson.quiz[i];
      // 按钮类题型做结构校验（正确答案唯一 / 禁入点判定与引擎一致）
      if (q.type === 'choice') {
        const n = (q.options || []).filter(o => o.ok).length;
        if (n !== 1) failed.push(`${lesson.id} Q${i + 1} 选择题答案数=${n}`);
        else solved++;
        continue;
      }
      if (q.type === 'yesno') {
        if (typeof q.answer !== 'boolean') failed.push(`${lesson.id} Q${i + 1} yesno 缺 answer`);
        else solved++;
        continue;
      }
      if (q.type === 'forbid') {
        const b0 = E.boardFromSpec({ size: 9, b: q.b, w: q.w });
        const legal = E.isLegal(b0, 9, E.idx(q.point[0], q.point[1], 9), q.turn === 'W' ? E.WHITE : E.BLACK, null).ok;
        if (q.expect !== undefined && legal !== q.expect) failed.push(`${lesson.id} Q${i + 1} 禁入点判定不符`);
        else solved++;
        continue;
      }
      const idx = w.WQQuiz.findSolution(q, 9);
      if (idx == null) { failed.push(`${lesson.id} Q${i + 1} (${q.type}) 找不到解`); continue; }
      const board = E.boardFromSpec({ size: 9, b: q.b, w: q.w });
      const pick = ['pickPoint', 'libPoint', 'pickStone', 'eyePoint'].indexOf(q.type) >= 0;
      let ok;
      if (pick) ok = w.WQQuiz.checkPoint(q, board, 9, idx);
      else ok = w.WQQuiz.checkMove(q, board, 9, idx).ok;
      if (ok) solved++; else failed.push(`${lesson.id} Q${i + 1} (${q.type}) 判题不通过`);
    }
  }
  console.log(`自动答题：${solved} / 60 题通过`);

  // 3) 进度写入
  const d2 = await load('lesson/index.html', 'id=p03');
  const w2 = d2.window;
  await new Promise(r => setTimeout(r, 200));
  w2.WQ.Progress.setStar('p03', 0);
  const total = w2.WQ.Progress.totalStars();
  if (total < 1) errors.push('进度写入失败');
  console.log('进度写入检查：total=' + total);

  failed.forEach(f => errors.push(f));
  if (errors.length) {
    console.log('\n问题 ' + errors.length + ' 条：');
    errors.forEach(e => console.log('  [ERR] ' + e));
    process.exit(1);
  }
  console.log('\n全部冒烟测试通过 ✅');
})().catch(e => { console.error('冒烟测试异常：', e); process.exit(1); });
