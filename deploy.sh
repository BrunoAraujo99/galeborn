#!/bin/bash
# usage: deploy.sh "commit message"   (run after build.py; build id read from /tmp/b.log)
set -e
B=$(grep -o "BUILD [0-9-]*" /tmp/b.log | cut -d' ' -f2); D=/mnt/project-files/galeborn
cp /home/claude/duel/dist/galeborn.html $D/galeborn-$B.html; cp /home/claude/duel/dist/galeborn.html $D/galeborn.html
cp /home/claude/duel/src/*.js /home/claude/duel/src/index.html /home/claude/duel/src/theme.css /home/claude/duel/build.py $D/src/
cd /home/claude/galeborn && rm -rf public && cp -r /home/claude/duel/dist/web public
for f in /home/claude/duel/src/*; do n=$(basename $f); [ -f "$f" ] || continue; [ "$n" = three.min.js ] || [ "$n" = gltfloader.js ] || cp $f src/; done
cp /home/claude/duel/build.py /home/claude/duel/deploy.sh .; mkdir -p assets mock; cp -r /home/claude/duel/assets/art /home/claude/duel/assets/fonts assets/; [ -d /home/claude/duel/assets/arenas ] && cp -r /home/claude/duel/assets/arenas assets/ || true
cp /home/claude/duel/mock/*.js mock/; cp /home/claude/duel/test3*.js tests/ 2>/dev/null || true
git add -A && git commit -qm "$1 (build $B)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012C1B1N6htu5qAdu9iYPaSP" && git -c push.negotiate=true push -q origin main 2>&1 | grep -v moved | grep -v "new location" | grep -v "galeborn.git" || true
git log --oneline -1; echo STAGED $D/galeborn-$B.html
