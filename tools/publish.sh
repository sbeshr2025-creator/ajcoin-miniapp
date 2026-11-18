#!/bin/bash
# Publish the Ajcoin mini app to BOTH hosts.
#   1) GitHub Pages (mirror):   https://sbeshr2025-creator.github.io/ajcoin-miniapp/   — git push
#   2) GitLab Pages (primary):  https://ajcoin-adf71f.gitlab.io/   (project Kahlanfawaz/ajcoin)
#      GitLab builds from the GitHub commit named in its MIRROR_REF file, so publishing there is a
#      one-line commit: MIRROR_REF=<sha>. There is no GitLab token on this box; make that commit with
#      the GitLab connector (add_commit, project 89126145, branch main, file MIRROR_REF).
# Usage:  tools/publish.sh "commit message"     (checks, commits, pushes, prints the MIRROR_REF step)
#         tools/publish.sh verify [version]      (checks both hosts serve that version)
set -euo pipefail
cd "$(dirname "$0")/.."
GH=https://sbeshr2025-creator.github.io/ajcoin-miniapp
GL=https://ajcoin-adf71f.gitlab.io
ver() { sed -n 's/^const VERSION = "\([0-9.]*\)".*/\1/p' sw.js; }

verify() {
  local v=${1:-$(ver)} ok=0
  for host in "$GL" "$GH"; do
    for f in "" "sw.js" "ajdata.js?v=$v" "tg-web-app.js?v=$v" "lib-lwc-4.2.3.js?v=$v" "v19.js?v=$v"; do
      case "$f" in *\?*) u="$host/$f&nc=$RANDOM";; *) u="$host/$f?nc=$RANDOM";; esac
      c=$(curl -s -o /dev/null -w '%{http_code}' "$u" 2>/dev/null || echo 000)
      [ "$c" = 200 ] || { echo "FAIL $c $host/$f"; ok=1; }
    done
    if curl -s "$host/sw.js?nc=$RANDOM" | grep -q "const VERSION = \"$v\""; then echo "ok   $host serves v$v"; else echo "WAIT $host does not serve v$v yet"; ok=1; fi
  done
  return $ok
}

if [ "${1:-}" = "verify" ]; then verify "${2:-}"; exit $?; fi
msg=${1:?commit message}
v=$(ver)
# version must be consistent everywhere
bad=$(grep -oE '\.js\?v=[0-9.]+' index.html | sort -u | grep -v "js?v=$v$" || true)
[ -z "$bad" ] || { echo "index.html has other versions: $bad"; exit 1; }
# never publish secrets, keys, balances or addresses
if git diff HEAD --name-only | grep -v -E '^(lib-|tg-web-app)' | xargs -r grep -n -I -E \
   '(api[_-]?secret|api[_-]?key\s*[:=]\s*["'"'"'][A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|glpat-|bot[0-9]{8,}:[A-Za-z0-9_-]{30,}|0x[0-9a-fA-F]{40}|T[1-9A-HJ-NP-Za-km-z]{33})' ; then
  echo "refusing: something that looks like a secret or an address is in the change"; exit 1
fi
git add -A
git commit -qm "$msg" || echo "(nothing new to commit)"
git push -q
sha=$(git rev-parse HEAD)
echo "GitHub pushed: $sha (v$v)"
echo "NEXT (GitLab): add_commit project 89126145 branch main: update MIRROR_REF = $sha"
echo "THEN: tools/publish.sh verify $v"
