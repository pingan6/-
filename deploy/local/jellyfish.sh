#!/usr/bin/env bash
# Operate this isolated deployment without changing the PingAn project.
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Public images need no registry login; avoid the stalled macOS Keychain helper.
# Preserve the selected daemon without modifying the user's Docker configuration.
task_docker_host="${DOCKER_HOST:-$(docker context inspect --format '{{.Endpoints.docker.Host}}')}"
docker_cmd=(docker --config "$TASK_ROOT/deploy/local/docker-public" --host "$task_docker_host")
compose_args=(--project-name jellyfish-local --env-file "$TASK_ROOT/deploy/compose/.env" -f "$TASK_ROOT/deploy/compose/docker-compose.yml" -f "$TASK_ROOT/deploy/local/compose.override.yml")
case "${1:-status}" in
  start)
    "${docker_cmd[@]}" compose "${compose_args[@]}" up --build -d
    "${docker_cmd[@]}" compose "${compose_args[@]}" exec -T backend uv run python init_local_storage.py
    ;;
  stop) "${docker_cmd[@]}" compose "${compose_args[@]}" stop ;;
  status) "${docker_cmd[@]}" compose "${compose_args[@]}" ps -a ;;
  *) printf '%s\n' "Usage: bash deploy/local/jellyfish.sh start|stop|status"; exit 2 ;;
esac
