#!/usr/bin/env bash
# ================================================================
# Nexora360 Oficinas — Setup Inicial da VPS
# ================================================================
# Execute UMA VEZ no servidor após o primeiro rsync:
#
#   chmod +x vps-setup.sh
#   ./vps-setup.sh seu-email@gmail.com
#
# Pré-requisitos:
#   - Ubuntu 24.04 com Nginx instalado e rodando
#   - DNS dos 4 subdomínios apontando para 72.61.135.206
#   - Projeto já transferido para /var/www/nexora360-oficinas/
#   - Docker instalado
# ================================================================

set -euo pipefail

# ── Parâmetros ────────────────────────────────────────────────────
EMAIL="${1:-}"
DEPLOY_DIR="/var/www/nexora360-oficinas"
NGINX_CONF_SRC="$DEPLOY_DIR/docker/nginx/oficinas.conf"
NGINX_SITE="/etc/nginx/sites-enabled/nexora-oficinas"
CERTBOT_WEBROOT="/var/www/certbot"

DOMAINS=(
    "oficina.nexora360.cloud"
    "api-oficina.nexora360.cloud"
    "bot.nexora360.cloud"
    "track.nexora360.cloud"
)

# ── Cores ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[SETUP]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

# ── Validações ────────────────────────────────────────────────────
[ "$EUID" -eq 0 ] || fail "Execute como root: sudo ./vps-setup.sh EMAIL"
[ -n "$EMAIL" ]   || fail "Informe o e-mail: ./vps-setup.sh seu@email.com"
[ -d "$DEPLOY_DIR" ] || fail "Diretório $DEPLOY_DIR não encontrado. Rode o transfer.sh primeiro."
[ -f "$NGINX_CONF_SRC" ] || fail "Arquivo $NGINX_CONF_SRC não encontrado."

# ── 1. Instalar Certbot ───────────────────────────────────────────
log "Verificando Certbot..."
if ! command -v certbot &>/dev/null; then
    log "Instalando Certbot..."
    apt-get update -qq
    apt-get install -y certbot python3-certbot-nginx
    ok "Certbot instalado."
else
    ok "Certbot já instalado: $(certbot --version 2>&1 | head -1)"
fi

# ── 2. Criar diretório webroot para ACME ─────────────────────────
log "Criando diretório webroot para Certbot..."
mkdir -p "$CERTBOT_WEBROOT"
ok "Webroot: $CERTBOT_WEBROOT"

# ── 3. Config temporária HTTP para validação certbot ─────────────
log "Criando config Nginx temporária para validação de domínios..."
cat > /etc/nginx/sites-available/nexora-oficinas-temp <<NGINX
server {
    listen 80;
    server_name ${DOMAINS[*]};

    location /.well-known/acme-challenge/ {
        root $CERTBOT_WEBROOT;
    }

    location / {
        return 200 'nexora360-oficinas-setup';
        add_header Content-Type text/plain;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/nexora-oficinas-temp /etc/nginx/sites-enabled/nexora-oficinas-temp
nginx -t || fail "Config Nginx temporária inválida."
systemctl reload nginx
ok "Nginx recarregado com config temporária."

# ── 4. Verificar DNS antes de gerar certificado ───────────────────
log "Verificando DNS dos subdomínios..."
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
ALL_OK=true
for domain in "${DOMAINS[@]}"; do
    RESOLVED=$(dig +short "$domain" 2>/dev/null | tail -1)
    if [ "$RESOLVED" = "$SERVER_IP" ]; then
        ok "  $domain → $RESOLVED"
    else
        warn "  $domain → $RESOLVED (esperado: $SERVER_IP)"
        ALL_OK=false
    fi
done
if [ "$ALL_OK" = false ]; then
    warn "Alguns domínios ainda não resolvem para este servidor."
    warn "O Certbot pode falhar. Pressione Enter para continuar ou Ctrl+C para abortar."
    read -r
fi

# ── 5. Gerar certificado SSL (1 cert cobre os 4 domínios) ─────────
log "Gerando certificado SSL para os 4 subdomínios..."
certbot certonly \
    --webroot \
    --webroot-path "$CERTBOT_WEBROOT" \
    -d oficina.nexora360.cloud \
    -d api-oficina.nexora360.cloud \
    -d bot.nexora360.cloud \
    -d track.nexora360.cloud \
    --non-interactive \
    --agree-tos \
    -m "$EMAIL" \
    --keep-until-expiring
ok "Certificado gerado: /etc/letsencrypt/live/oficina.nexora360.cloud/"

# ── 6. Remover config temporária e ativar config final ───────────
log "Ativando config Nginx final (com HTTPS)..."
rm -f /etc/nginx/sites-enabled/nexora-oficinas-temp
rm -f /etc/nginx/sites-available/nexora-oficinas-temp
cp "$NGINX_CONF_SRC" "$NGINX_SITE"
nginx -t || fail "Config Nginx final inválida. Verifique $NGINX_CONF_SRC"
systemctl reload nginx
ok "Nginx recarregado com HTTPS ativo."

# ── 7. Copiar .env de produção para o backend ─────────────────────
log "Verificando .env do backend..."
if [ -f "$DEPLOY_DIR/backend/.env.production" ] && [ ! -f "$DEPLOY_DIR/backend/.env" ]; then
    cp "$DEPLOY_DIR/backend/.env.production" "$DEPLOY_DIR/backend/.env"
    warn ".env copiado de .env.production — verifique e preencha as variáveis reais!"
elif [ -f "$DEPLOY_DIR/backend/.env" ]; then
    ok ".env do backend já existe."
else
    fail "Nenhum .env encontrado em $DEPLOY_DIR/backend/. Crie o arquivo antes de continuar."
fi

# ── 8. Build e subida dos containers ─────────────────────────────
log "Fazendo build e subindo containers Docker..."
cd "$DEPLOY_DIR"
docker compose -f docker/docker-compose.production.yml up -d --build
ok "Containers em execução."

# ── 9. Aguardar backend ficar saudável ───────────────────────────
log "Aguardando backend inicializar..."
RETRIES=20
for i in $(seq 1 $RETRIES); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/health 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        ok "Backend respondendo (HTTP $STATUS)"
        break
    fi
    if [ "$i" = "$RETRIES" ]; then
        warn "Backend não respondeu após 80s. Verifique os logs:"
        warn "  docker compose -f docker/docker-compose.production.yml logs backend"
        break
    fi
    echo -n "."
    sleep 4
done

# ── 10. Configurar renovação automática do certificado ───────────
log "Configurando renovação automática do certificado..."
CRON_JOB="0 3 * * * certbot renew --quiet --webroot --webroot-path $CERTBOT_WEBROOT && systemctl reload nginx"
( crontab -l 2>/dev/null | grep -v certbot; echo "$CRON_JOB" ) | crontab -
ok "Cron configurado: renovação automática às 3h."

# ── Resumo ────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup do Nexora360 Oficinas concluído!                ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend:  ${BLUE}https://oficina.nexora360.cloud${NC}"
echo -e "  Backend:   ${BLUE}https://api-oficina.nexora360.cloud/health${NC}"
echo -e "  Admin:     ${BLUE}https://bot.nexora360.cloud${NC}"
echo -e "  Tracking:  ${BLUE}https://track.nexora360.cloud${NC}"
echo ""
echo -e "  Logs:   ${BLUE}docker compose -f $DEPLOY_DIR/docker/docker-compose.production.yml logs -f${NC}"
echo -e "  Status: ${BLUE}docker compose -f $DEPLOY_DIR/docker/docker-compose.production.yml ps${NC}"
echo ""
echo -e "${YELLOW}IMPORTANTE: Edite $DEPLOY_DIR/backend/.env com as variáveis reais${NC}"
echo -e "${YELLOW}(DATABASE_URL, JWT_SECRET, SUPABASE_*, SMTP_*, etc.)${NC}"
echo ""
