# 小围棋 · 幼儿围棋陪学网站

给 5–6 岁孩子和零基础家长用的围棋启蒙站。纯静态、无后端、无构建，直接放到 Gitee Pages 就能用。

## 本地先看效果

- 方式一（推荐）：在本目录执行 `python3 -m http.server 8080`，浏览器打开 http://localhost:8080
- 方式二：直接双击 `index.html`（功能都在，只是换设备时的进度保存依赖浏览器环境）

## 已上线

- 仓库：https://gitee.com/urwater/weiqi-school
- 网址（Pages 开启后）：https://urwater.gitee.io/weiqi-school/

## 部署到 Gitee Pages

### 一键脚本（更新内容后跑它）

```bash
bash tools/deploy-gitee.sh <Gitee用户名> <私人令牌> [仓库名]
# 本项目的实际命令
bash tools/deploy-gitee.sh urwater <你的令牌> weiqi-school
```

脚本会：建仓库（若无）→ **强制设为公开** → 提交 → 推送 → 打印 Pages 步骤。

### 令牌的三个坑（都踩过）

1. **作用范围必须选「全部仓库」**。选了「指定仓库」的令牌是仓库级的，无法建新仓库，API 会返回 `仓库级私人令牌无权执行此操作`
2. **必须勾选 `projects` 权限**
3. **API 建出来的仓库默认是私有的**，脚本已自动 PATCH 改成公开（Pages 强制要求公开）

### 开启 Pages（只能网页操作，API 不支持）

1. 打开 https://gitee.com/urwater/weiqi-school
2. 顶部菜单「服务」→「Gitee Pages」
3. 部署分支选 `main`，部署目录填 `/` → 点「启动」
4. 网址：https://urwater.gitee.io/weiqi-school/

### 另外两条硬规则

- **必须实名认证**：Gitee Pages 强制要求，首次提交后审核约 1 个工作日
- **推送后要点「更新」**：免费版不会自动重新部署，改完代码要回 Pages 页面点一次

> 仓库名建议用英文。`自学围棋` 这类中文名会让网址变成
> `https://用户名.gitee.io/%E8%87%AA%E5%AD%A6%E5%9B%B4%E6%A3%8B/`，在微信里又长又容易被截断。

> 仓库里已有 `.nojekyll`，避免 Pages 忽略以下划线开头的文件。

## 目录结构

```
index.html                 首页
textbook/index.html        课程表（20 课）+ 幼儿园课本对照
lesson/index.html          上课页（学一学 / 玩一玩 / 练一练 + 家长 30 秒速读）
training/index.html        训练场（自由摆棋 + 39 个棋形动画）
exercises/index.html       闯关练习 + 错题重练
parents/index.html         家长指南（15 分钟节奏表、话术、术语速查、FAQ）
progress/index.html        学习进度与错题本、导出/清空
assets/js/engine.js        围棋规则引擎（气/提子/禁入点/打劫/眼）
assets/js/board.js         SVG 棋盘组件（点击、拖拽、气点、提子动画）
assets/js/quiz.js          判题引擎（所有答案都由规则引擎客观判定）
assets/js/app.js           进度存储、音效、导航、反馈动画、读题语音
data/curriculum.js         20 课课程内容（39 个演示 + 60 道题）
data/textbook.js           幼儿园两学期课本目录（仅对照）
tools/validate.js          课程数据体检：演示合法 + 每题有解
tools/smoke.js             冒烟测试：7 个页面加载 + 60 题自动作答
```

## 改内容（家长也能改）

- 加课/改题：编辑 `data/curriculum.js`，坐标是 `[行, 列]`，从 0 开始，左上角是 `[0,0]`，棋盘 9 路
- 改完务必跑体检：
  ```bash
  node tools/validate.js     # 演示序列是否合法、每道题是否真的有解
  node tools/smoke.js        # 需要 jsdom：页面能否无错加载（可选）
  ```

## 课程主线（标准启蒙路线）

| 阶段 | 课次 | 内容 |
|---|---|---|
| A 认识围棋 | 1–2 | 棋盘与棋子、下棋规则 |
| B 气 | 3–4 | 什么是气、数气 |
| C 打吃与提子 | 5–6 | 打吃（叫吃）、提子 |
| D 逃跑 | 7–8 | 逃跑（长气）、跑不掉的时候 |
| E 特别规则 | 9–10 | 禁入点、打劫 |
| F 吃子技巧 | 11–13 | 双吃、关门吃与抱吃、征吃 |
| G 连接与分断 | 14–15 | 连接（粘）、分断（断） |
| H 死活 | 16–18 | 眼、两只眼 = 活棋、做眼与破眼 |
| I 围地与终局 | 19–20 | 围地、终局与数子 |

课本（两个学期的延时课教材）内容有交叉、也有跳着学，这里只作对照，不驱动课程顺序。

## 提高篇（待补）

对杀（有公气/看不见的气/延气）、棋形、双活、综合练习 —— 等主线 20 课学完再加。
