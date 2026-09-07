#!/bin/bash
# Build the front end and publish it to the CloudFront-backed S3 bucket.
#
# Reads the bucket name and distribution id from the frau-erica-hosting
# stack's outputs rather than hardcoding them, so there's nothing to keep
# in sync by hand if the stack is ever rebuilt.
#
# Usage:  ./hosting/deploy-app.sh
set -euo pipefail

STACK=frau-erica-hosting
PROFILE=frau-erica-v2-deploy
REGION=us-east-1
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK" --region "$REGION" --profile "$PROFILE" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

BUCKET="$(stack_output BucketName)"
DISTRIBUTION="$(stack_output DistributionId)"

if [ -z "$BUCKET" ] || [ "$BUCKET" = "None" ]; then
  echo "Could not read BucketName from the $STACK stack -- is it deployed?" >&2
  exit 1
fi

echo "==> Building"
cd "$REPO_ROOT/app"
npm run build

# Two passes, and the order matters. Vite fingerprints every asset
# filename, so those are safe to cache forever -- but index.html is the
# one file whose name never changes, and it's the file that names which
# fingerprinted chunks are current. Cache it and a returning visitor gets
# an old index.html pointing at chunks that no longer exist, which is
# exactly the blank-page failure ErrorBoundary exists to catch. Better to
# not create the situation in the first place.
#
# Assets go up first so that every chunk the new index.html references
# already exists before that index.html becomes visible.
echo "==> Uploading fingerprinted assets (long cache)"
aws s3 sync dist/ "s3://$BUCKET" \
  --profile "$PROFILE" --region "$REGION" \
  --delete \
  --exclude "index.html" \
  --exclude "robots.txt" \
  --cache-control "public,max-age=31536000,immutable"

echo "==> Uploading index.html and robots.txt (no cache)"
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --profile "$PROFILE" --region "$REGION" \
  --cache-control "no-cache,must-revalidate" \
  --content-type "text/html"
if [ -f dist/robots.txt ]; then
  aws s3 cp dist/robots.txt "s3://$BUCKET/robots.txt" \
    --profile "$PROFILE" --region "$REGION" \
    --cache-control "no-cache,must-revalidate" \
    --content-type "text/plain"
fi

# Belt and braces: the headers above mean index.html shouldn't be stale
# anyway, but an invalidation makes the deploy visible immediately rather
# than at the next revalidation, and costs nothing at this frequency
# (1,000 free invalidation paths a month).
echo "==> Invalidating CloudFront"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION" \
  --paths "/*" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'Invalidation.Id' --output text

echo "==> Done. Live at https://frauerica.org"
