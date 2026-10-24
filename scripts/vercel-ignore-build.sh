#!/usr/bin/env bash
# Vercel "Ignored Build Step" for the deck-analysis-app project.
#
# This repository holds two Vercel projects: deck-analysis-app is the Next.js app
# at the REPOSITORY ROOT (serving app.sourcecapital.co.uk), and valuation-engine
# builds from apps/valuation-engine. Neither imports from the other, and neither
# does the deck app import packages/ (valuation-core, consumed by the engine from
# GitHub Packages), so a commit touching only apps/ or packages/ cannot change
# what deck-analysis-app ships. Before this
# existed every such commit rebuilt it anyway -- fourteen wasted builds on
# 27 Sep 2026 alone, which is what exhausted the build quota.
#
# Vercel semantics: exit 0 => SKIP the build, exit 1 => RUN the build.
# Every uncertain path below exits 1. The failure mode is therefore a wasted
# build, never a missed deploy of the live domain.

set -u

# VERCEL_GIT_PREVIOUS_SHA is the last SUCCESSFULLY DEPLOYED commit, which is the
# correct base rather than HEAD^: when several commits arrive in one push Vercel
# builds only the tip, so diffing HEAD^..HEAD would miss a root-app change made
# in an earlier commit of that same push and skip a build that was needed.
# Vercel only exposes it once an ignore step is configured, hence the fallback.
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ]; then
  base="$(git rev-parse --verify --quiet 'HEAD^' || true)"
fi

# No usable base (first deploy, or a shallow clone lacking that commit): build.
if [ -z "$base" ] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  echo "No usable base commit to compare against - building."
  exit 1
fi

# ':(top)' makes the pathspec repo-root-relative whatever directory Vercel runs
# this from; the excludes drop the sibling Vercel project and the packages.
if git diff --quiet "$base" HEAD -- ':(top)' ':(top,exclude)apps' ':(top,exclude)packages'; then
  echo "Nothing outside apps/ or packages/ changed between $(git rev-parse --short "$base") and $(git rev-parse --short HEAD) - skipping build."
  exit 0
fi

echo "Changed outside apps/ and packages/ - building:"
git diff --name-only "$base" HEAD -- ':(top)' ':(top,exclude)apps' ':(top,exclude)packages'
exit 1
