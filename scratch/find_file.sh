#!/bin/bash
for branch in $(git branch | sed 's/* //'); do
  echo "Checking branch: $branch"
  git ls-tree -r "$branch" | grep timetable-lifecycle.service.ts
done
