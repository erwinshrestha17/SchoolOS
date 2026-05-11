#!/bin/bash
for branch in $(git branch -r | grep -v 'HEAD' | sed 's/  origin\///'); do
  echo "Checking remote branch: $branch"
  git ls-tree -r "origin/$branch" | grep -E "timetable-lifecycle.service.ts|timetable-conflict.service.ts"
done
