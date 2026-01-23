#!/bin/bash
set -euxo pipefail
echo "Creating submission archive: submission.zip"
git archive --format=zip --prefix=source/ HEAD > submission.zip
7z a submission.zip README.md
echo "Building project..."
pnpm run build
7z a submission.zip dist
echo "Submission archive created: submission.zip"