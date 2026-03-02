#!/usr/bin/env bash
# ================================================================
# Nexora360 Oficinas — Script de Deploy (VPS)
# ================================================================
# Uso (no servidor, após cada atualização via rsync):
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Pré-requisitos:
#   - vps-setup.sh já executado (SSL e nginx configurados)
#   - backend/.env preenchido com variáveis reais
# ================================================================

set -euo pipefail

REPO_DIR="/var/www/nexora360-oficinas"
COMPOSE_FILE="$REPO_DIR/docker/docker-compose.production.yml"
BACKEND_ENV="$REPO_DIR/backend/.env"
API_HEALTH="http://localhost:3002/health"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ── Cores ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

# ── Verificações iniciais ─────────────────────────────────────────
log "Iniciando deploy — $TIMESTAMP"

[ "$EUID" -eq 0 ] || fail "Execute como root."
command -v docker >/dev/null 2>&1 || fail "Docker não encontrado."
[ -f "$BACKEND_ENV" ] || fail "$BACKEND_ENV não encontrado. Configure o .env antes do deploy."
[ -d "$REPO_DIR" ]    || fail "Diretório $REPO_DIR não encontrado."

# ── Atualizar nginx config se mudou ──────────────────────────────
NGINX_SITE="/etc/nginx/sites-enabled/nexora-oficinas"
NGINX_CONF_SRC="$REPO_DIR/docker/nginx/oficinas.conf"
if [ -f "$NGINX_CONF_SRC" ]; then
    if ! diff -q "$NGINX_CONF_SRC" "$NGINX_SITE" &>/dev/null; then
        log "oficinas.conf mudou — atualizando nginx..."
        cp "$NGINX_CONF_SRC" "$NGINX_SITE"
        nginx -t || fail "Config Nginx inválida após atualização."
        systemctl reload nginx
        ok "Nginx atualizado e recarregado."
    fi
fi

# ── Build e restart dos containers ───────────────────────────────
log "Fazendo build e restart dos containers..."
cd "$REPO_DIR"
docker compose -f "$COMPOSE_FILE" build --no-cache backend frontend
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
ok "Containers reiniciados."

# ── Aguardar API ficar saudável ───────────────────────────────────
log "Verificando saúde da API..."
RETRIES=20
WAIT=4

for i in $(seq 1 $RETRIES); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_HEALTH" 2>/dev/null || echo "000")

    if [ "$STATUS" = "200" ]; then
        ok "API respondendo (HTTP $STATUS)"
        break
    fi

    if [ "$i" = "$RETRIES" ]; then
        fail "API não respondeu após $((RETRIES * WAIT))s. Logs: docker compose -f $COMPOSE_FILE logs backend"
    fi

    log "Aguardando... tentativa $i/$RETRIES (HTTP $STATUS)"
    sleep $WAIT
done

# ── Reload nginx para garantir estado limpo ───────────────────────
systemctl reload nginx
ok "Nginx recarregado."

# ── Limpeza de imagens antigas ────────────────────────────────────
log "Removendo imagens Docker não utilizadas..."
docker image prune -f --filter "until=24h" 2>/dev/null || true

# ── Resumo ────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy concluído com sucesso! — $TIMESTAMP  ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend:  ${BLUE}https://oficina.nexora360.cloud${NC}"
echo -e "  API:       ${BLUE}https://api-oficina.nexora360.cloud/health${NC}"
echo -e "  Admin:     ${BLUE}https://bot.nexora360.cloud${NC}"
echo -e "  Tracking:  ${BLUE}https://track.nexora360.cloud${NC}"
echo ""
echo -e "  Logs:   ${BLUE}docker compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "  Status: ${BLUE}docker compose -f $COMPOSE_FILE ps${NC}"
echo ""
