#!/bin/bash
# 部署到 GitHub Pages（纯静态，无需实名）
#
# 用法：
#   bash tools/deploy-github.sh <GitHub用户名> [仓库名] [PersonalAccessToken]
#
# 说明：
#   - 推送走 SSH(22)，因为本机访问 github.com 的 HTTPS 走代理会 502
#     前提：已把 ~/.ssh/id_ed25519.pub 添加到 https://github.com/settings/keys
#   - 第三个参数 token 可选：给了就自动建仓库/改公开；不给就要求你先在网页建好空仓库
#   - 仓库必须 Public（私有仓库免费账号用不了 Pages）
#
set -e
USER="$1"
REPO="${2:-weiqi-school}"
TOKEN="$3"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if [ -z "$USER" ]; then
  echo "用法: bash tools/deploy-github.sh <GitHub用户名> [仓库名] [token]"
  exit 1
fi

echo "==> 目标仓库: github.com/$USER/$REPO"

# 1) 建仓库（有 token 才自动建；没有就跳过，靠网页创建）
if [ -n "$TOKEN" ]; then
  echo "==> 检查仓库是否存在..."
  HTTP=$(curl -s -o /tmp/gh_repo.json -w "%{http_code}" \
    --max-time 30 -H "Authorization: Bearer $TOKEN" \
    "https://api.github.com/repos/$USER/$REPO")
  if [ "$HTTP" = "200" ]; then
    echo "    仓库已存在"
  else
    echo "==> 创建仓库（public）..."
    HTTP=$(curl -s -o /tmp/gh_repo.json -w "%{http_code}" \
      --max-time 30 -X POST "https://api.github.com/user/repos" \
      -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
      -d "{\"name\":\"$REPO\",\"description\":\"幼儿围棋陪学网站\",\"private\":false,\"auto_init\":false,\"has_issues\":false,\"has_wiki\":false,\"has_projects\":false}")
    if [ "$HTTP" = "201" ]; then
      echo "    创建成功"
    else
      echo "    [!] 创建仓库返回 HTTP $HTTP："
      head -c 400 /tmp/gh_repo.json; echo
      echo "    常见原因：token 权限不足（需勾选 repo/public_repo），或仓库名已存在。"
      echo "    可改为在网页手动创建公开空仓库后，重跑本脚本（不带 token）。"
      exit 1
    fi
  fi
else
  echo "==> 未提供 token，假定仓库已在网页创建（Public、不要勾选任何初始化文件）"
fi

# 2) 本地提交（有改动才提交）
if [ -n "$(git status --porcelain)" ]; then
  echo "==> 提交本地改动..."
  git add -A
  git -c user.name="weiqi" -c user.email="weiqi@local" \
    commit -q -m "更新课程内容 $(date '+%Y-%m-%d %H:%M')"
else
  echo "==> 本地无改动，跳过提交"
fi

git branch -M main 2>/dev/null || true

# 3) 推送（SSH）
REMOTE="git@github.com:$USER/$REPO.git"
# 用独立 remote 名 "github"，不覆盖 origin（origin 保留指向 Gitee 作备份）
git remote remove github 2>/dev/null || true
git remote add github "$REMOTE"

echo "==> 推送到 GitHub（SSH）..."
if git push -u github main 2>/tmp/gh_push.log; then
  echo "    推送成功"
else
  echo "    [!] 推送失败，日志："
  tail -12 /tmp/gh_push.log
  echo
  echo "    若提示 Permission denied (publickey)："
  echo "      把下面这行公钥添加到 https://github.com/settings/keys"
  cat ~/.ssh/id_ed25519.pub 2>/dev/null
  exit 1
fi

# 4) 尝试用 API 开启 Pages（有 token 才行）
PAGES_URL="https://$USER.github.io/$REPO/"
if [ -n "$TOKEN" ]; then
  echo "==> 尝试开启 GitHub Pages..."
  curl -s -o /tmp/gh_pages.json --max-time 40 \
    -X POST "https://api.github.com/repos/$USER/$REPO/pages" \
    -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
    -d '{"source":{"branch":"main","path":"/"}}' >/dev/null
  if grep -q '"url"' /tmp/gh_pages.json 2>/dev/null; then
    echo "    Pages 已开启（或已在运行）"
  else
    echo "    API 未直接开启（可能需网页确认），请按下面步骤手动开"
  fi
fi

cat <<EOF

==========================================================
 代码已推送。最后一步：开启 GitHub Pages

 1. 打开 https://github.com/$USER/$REPO/settings/pages
 2. Source 选 "Deploy from a branch"
 3. Branch 选 main、目录选 / (root)，点 Save
 4. 等 1–3 分钟，访问：$PAGES_URL

 仓库必须是 Public；每次推送后 GitHub Pages 会自动重新部署，
 不需要像 Gitee 那样手动点更新。
==========================================================
EOF
