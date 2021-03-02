#!/usr/bin/env bash
set -e

SCRIPT_DIR=$(dirname $0)
cd $SCRIPT_DIR/../app/src
PROJECT_ROOT=$(pwd)
echo "Workspace:${PROJECT_ROOT}"


SONARQUBE_URL="https://www.edisonpark.net/sonarqube"
SONARQUBE_TOKEN="dd35c7159e2d4bd36309a199a9089437fed2883a"

PROJECT_KEY=Mailspring

usage() {
  cat <<EOF
Usage :
  -h                            Display this message
                                Please view report in https://www.edisonpark.net/sonarqube
  -i                            sonar check in cli mode
  -d                            sonar check in docker mode
EOF
} # ----------  end of function usage  ----------

function run_via_cli() {
  command -v sonar-scanner >/dev/null 2>&1 || { echo "I require sonar-scanner but it's not installed. Aborting."; exit 1; }

  sonar-scanner \
    -Dsonar.projectKey=${PROJECT_KEY} \
    -Dsonar.host.url=$SONARQUBE_URL \
    -Dsonar.login=$SONARQUBE_TOKEN \
    -Dsonar.sources=${PROJECT_ROOT} \
    -Dsonar.exclusions=**/*.h,**/*.c,**/*.cpp
}

function run_via_docker() {
  command -v docker >/dev/null 2>&1 || { echo "I require docker but it's not installed. Aborting."; exit 1; }

  docker run \
    --rm \
    -e SONAR_PROJECT_KEY=${PROJECT_KEY} \
    -e SONAR_HOST_URL="${SONARQUBE_URL}" \
    -e SONAR_LOGIN="${SONARQUBE_TOKEN}" \
    -v "${PROJECT_ROOT}:/usr/src" \
    sonarsource/sonar-scanner-cli
}

mode="cli"
while getopts :hid OPTION; do
  case $OPTION in
  i)
    mode="cli"
    ;;
  d) mode="docker" ;;
  h)
    unset mode;;
  *)
    unset mode;;
  esac
done
if [ "$mode" = "docker" ]; then
  run_via_docker
elif [ "$mode" = "cli" ]; then
  run_via_cli
else
  usage
fi
