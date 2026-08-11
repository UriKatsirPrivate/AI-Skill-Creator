#!/usr/bin/env bash
# Deploy AI Skill Creator to Cloud Run: build -> push -> deploy.
#
# cloudbuild.yaml's substitutions default to a literal "PROJECT_ID" placeholder
# for _RUN_SA_EMAIL -- omitting --substitutions submits a build that tries to
# deploy-as a service account literally named "ai-skill-creator-run@PROJECT_ID...."
# and fails at the deploy step. This script derives it from the current project
# instead.
#
# Usage:
#   deploy/deploy.sh
#   AISKILL_REGION=us-central1 deploy/deploy.sh   # e.g. deploying to a different region
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${AISKILL_PROJECT:-$(gcloud config get-value project)}"
REGION="${AISKILL_REGION:-us-west1}"
SERVICE="${AISKILL_SERVICE:-ai-skill-creator}"
GOOGLE_CLOUD_LOCATION="${AISKILL_VERTEX_LOCATION:-global}"
RUN_SA_EMAIL="ai-skill-creator-run@${PROJECT}.iam.gserviceaccount.com"

echo "  PROJECT=$PROJECT REGION=$REGION SERVICE=$SERVICE"
echo "  RUN_SA_EMAIL=$RUN_SA_EMAIL"
echo "  GOOGLE_CLOUD_LOCATION=$GOOGLE_CLOUD_LOCATION"

gcloud builds submit "$REPO_ROOT" \
  --config "$REPO_ROOT/deploy/cloudbuild.yaml" \
  --substitutions="_REGION=$REGION,\
_SERVICE=$SERVICE,\
_RUN_SA_EMAIL=$RUN_SA_EMAIL,\
_GOOGLE_CLOUD_LOCATION=$GOOGLE_CLOUD_LOCATION"

echo "== New revision =="
gcloud run services describe "$SERVICE" --region="$REGION" \
  --format='value(status.latestReadyRevisionName)'

echo "== Service URL =="
gcloud run services describe "$SERVICE" --region="$REGION" \
  --format='value(status.url)'
