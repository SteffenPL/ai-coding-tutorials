#!/usr/bin/env bash
set -euo pipefail

# Deploy built site to steffenpl/ai-coding-tutorials GitHub Pages
# Usage: ./deploy.sh

REPO="steffenpl/ai-coding-tutorials"
DEPLOY_BRANCH="gh-pages"
BUILD_DIR="build"
TEMP_DIR=$(mktemp -d)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Building site..."
BASE_PATH="/ai-coding-tutorials" npm run build

echo "==> Preparing deploy..."
cd "${TEMP_DIR}"
git init
git remote add origin "https://github.com/${REPO}.git"

# Try to pull existing gh-pages branch
if git ls-remote --heads origin "${DEPLOY_BRANCH}" | grep -q "${DEPLOY_BRANCH}"; then
    git fetch origin "${DEPLOY_BRANCH}" --depth 1
    git checkout "${DEPLOY_BRANCH}"
    # Remove old content
    git rm -rf . 2>/dev/null || true
else
    git checkout --orphan "${DEPLOY_BRANCH}"
fi

echo "==> Copying build output..."
cp -r "${SCRIPT_DIR}/${BUILD_DIR}"/. .
touch .nojekyll

echo "==> Committing and pushing..."
git add -A
if git diff --cached --quiet; then
    echo "==> No changes to deploy."
else
    git commit -m "Deploy $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    git push origin "${DEPLOY_BRANCH}"
    echo "==> Deployed to https://steffenpl.github.io/ai-coding-tutorials/"
fi

cd "${SCRIPT_DIR}"
rm -rf "${TEMP_DIR}"
echo "==> Done."
