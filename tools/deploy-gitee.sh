#!/bin/bash
# 一键推送到 Gitee 并提示开启 Pages
# 用法：  bash tools/deploy-gitee.sh <Gitee用户名> <私人令牌> [仓库名]
# 示例：  bash tools/deploy-gitee.sh zhangsan 1a2b3c4d5e6f weiqi-school
set -e

USER="$1"
TOKEN="$2"
REPO="${3:-weiqi-school}"

if [ -z "$USER" ] || [ -z "$TOKEN" ]; then
  echo "用法: bash tools/deploy-gitee.sh <Gitee用户名> <私人令牌> [仓库名]"
  echo "令牌获取: Gitee 网页 → 右上角头像 → 设置 → 私人令牌 → 生成新令牌 → 勾选 projects"
  exit 1
fi

echo "==> 1/4 检查/创建 Gitee 仓库 $REPO ..."
HTTP=$(curl -s -o /tmp/gitee_repo.json -w "%{http_code}" \
  -X POST "https://gitee.com/api/v5/user/repos?access_token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$REPO\",\"description\":\"幼儿围棋陪学网站（零基础家长陪学型）\",\"private\":false,\"auto_init\":false,\"has_issues\":false,\"has_wiki\":false}")

if [ "$HTTP" = "201" ]; then
  echo "    仓库创建成功"
elif [ "$HTTP" = "400" ] || [ "$HTTP" = "409" ]; then
  echo "    仓库已存在，直接推送"
elif grep -q "仓库级" /tmp/gitee_repo.json 2>/dev/null; then
  echo "    [!] 这个令牌是「仓库级」的，无权新建仓库。"
  echo "    请先在网页创建好公开仓库，并把令牌的作用范围改成「全部仓库」，再重跑本脚本。"
  echo "    网页创建仓库：https://gitee.com/projects/new → 公开 → 不要勾选任何初始化文件"
  exit 1
else
  echo "    [!] 创建仓库返回 HTTP $HTTP："
  head -c 400 /tmp/gitee_repo.json; echo
  echo "    若提示令牌无效，请重新生成令牌并确认勾选了 projects 权限、作用范围选「全部仓库」。"
  exit 1
fi

cd "$(dirname "$0")/.."

echo "==> 2/4 提交本地改动 ..."
git add -A
git -c user.name="weiqi" -c user.email="weiqi@local" commit -m "更新：$(date '+%Y-%m-%d %H:%M')" 2>/dev/null || echo "    （无新改动）"

echo "==> 3/4 关联并推送 ..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://$USER:$TOKEN@gitee.com/$USER/$REPO.git"
git branch -M main
git push -u origin main --force

echo
echo "==> 4/4 推送完成！"
echo
echo "现在请在浏览器完成最后一步（只需一次）："
echo "  1. 打开 https://gitee.com/$USER/$REPO"
echo "  2. 顶部菜单「服务」→「Gitee Pages」"
echo "  3. 部署分支选 main，部署目录填 / ，点「启动」"
echo "     （首次使用需实名认证，审核约 1 个工作日）"
echo "  4. 成功后网址： https://$USER.gitee.io/$REPO/"
echo
echo "注意：以后每次推送新版本，都要回到 Gitee Pages 页面点一次「更新」才会生效。"
