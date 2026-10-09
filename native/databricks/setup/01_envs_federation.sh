#!/usr/bin/env bash
# Step 3. Environments and identities: a CI service principal for staging and one for production, each
# with a GitLab OIDC federation policy, so CI deploys with no stored secret. Dev has no CI principal:
# merge-request pipelines get no Databricks access at all, and engineers deploy dev from their own login.
#
# Run once, as an account admin, from a laptop logged in to the ACCOUNT console:
#   databricks auth login --host https://accounts.cloud.databricks.com --account-id <account-id> --profile acct
#
# Why two principals, and two branches: the subject is matched exactly against GitLab's sub claim
# (project_path:<group>/<project>:ref_type:branch:ref:<branch>). Staging trusts main; production trusts
# release, a protected branch only maintainers can merge to. A pipeline on any other ref cannot mint a
# token for either, whatever .gitlab-ci.yml says. The boundary is enforced by Databricks, not by the CI file.
set -euo pipefail

ACCOUNT_PROFILE="${ACCOUNT_PROFILE:-acct}"
GITLAB_ISSUER="${GITLAB_ISSUER:-https://gitlab.com}"       # self-managed: https://gitlab.example.com
PROJECT_PATH="${PROJECT_PATH:?set PROJECT_PATH=my-group/spend-exceptions}"
ACCOUNT_ID="${ACCOUNT_ID:?set ACCOUNT_ID to your Databricks account id (the token audience)}"

# GitLab's sub claim: project_path:<group>/<project>:ref_type:<branch|tag>:ref:<name>
declare -A SUBJECT=(
  [stg]="project_path:${PROJECT_PATH}:ref_type:branch:ref:main"
  [prd]="project_path:${PROJECT_PATH}:ref_type:branch:ref:release"
)

for env in stg prd; do
  name="spend-exceptions-ci-${env}"
  echo "== ${env}: service principal ${name}"
  sp_json=$(databricks account service-principals create --display-name "$name" --profile "$ACCOUNT_PROFILE" -o json)
  sp_id=$(printf '%s' "$sp_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
  app_id=$(printf '%s' "$sp_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["applicationId"])')
  echo "   numeric id ${sp_id}, application (client) id ${app_id}  -> GitLab CI variable DATABRICKS_CLIENT_ID for ${env}"

  databricks account service-principal-federation-policy create "$sp_id" --profile "$ACCOUNT_PROFILE" --json "{
    \"oidc_policy\": {
      \"issuer\": \"${GITLAB_ISSUER}\",
      \"audiences\": [\"${ACCOUNT_ID}\"],
      \"subject\": \"${SUBJECT[$env]}\"
    }
  }"
done

# Runtime principals: what jobs run as (bundle run_as) and the role they use in Lakebase. No federation
# policy, so nothing outside Databricks can become them. The CI principal deploys; the runtime principal
# reads data and calls the agent. Give each CI principal the Service Principal User role on its runtime
# principal, so the deploy may set run_as to it.
for env in stg prd; do
  name="spend-jobs-${env}"
  echo "== ${env}: runtime principal ${name}"
  databricks account service-principals create --display-name "$name" --profile "$ACCOUNT_PROFILE" -o json \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print("   application id", d["applicationId"], "-> databricks.yml jobs_client_id")'
done

cat <<'NOTE'

Next, per environment, in the workspace (not the account):
  1. Add each principal to its workspace and give it only what its bundle deploys need
     (CAN MANAGE on the apps and jobs it owns, USE CATALOG / CREATE SCHEMA on its own catalog).
  2. In GitLab: Settings > CI/CD > Variables, per environment scope (staging, production): DATABRICKS_HOST,
     DATABRICKS_CLIENT_ID, DATABRICKS_ACCOUNT_ID, CATALOG, WAREHOUSE_ID, GENIE_SPACE_ID, LAKEBASE_ENDPOINT,
     LAKEBASE_HOST. None is a secret.
  3. Settings > Repository > Protected branches: protect main and release (merge: maintainers only);
     Settings > Merge requests: fast-forward merge, so release receives main's gated commit unchanged;
     Settings > CI/CD > Protected environments: protect production and require approval.
  4. Forks. A merge request from a fork runs in the fork's project, whose project_path matches no policy.
     But a maintainer can choose "Run pipeline in the parent project" for it, and that pipeline runs the
     FORK's .gitlab-ci.yml with the parent's path, on the fork's branch name. A fork branch named main
     could then match the staging subject. Never run a fork's pipeline in the parent project without
     reading its .gitlab-ci.yml diff; better, disable it for this project.
NOTE
