#!/usr/bin/env bash
# ================================================================
# Nexora360 Oficinas — Transfer Local → VPS
# ================================================================
# Transfere o projeto da máquina local para a VPS via rsync+SSH.
#
# Uso (Git Bash ou WSL):
#   chmod +x transfer.sh
#   ./transfer.sh
#
# Para deploy completo após o transfer:
#   ssh root@72.61.135.206 "cd /var/www/nexora360-oficinas && ./deploy.sh"
# ================================================================

set -euo pipefail

VPS_HOST="root@72.61.135.206"
VPS_DIR="/var/www/nexora360-oficinas"

# Detecta o diretório do projeto (onde este script está)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DIR="$SCRIPT_DIR/"

# ── Cores ─────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${BLUE}[TRANSFER]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# ── Verificações ──────────────────────────────────────────────────
command -v rsync >/dev/null 2>&1 || {
    echo "rsync não encontrado."
    echo ""
    echo "Opções:"
    echo "  WSL:      sudo apt-get install rsync"
    echo "  Git Bash: instale o Git for Windows com rsync, ou use WinSCP"
    echo "  WinSCP:   conecte em $VPS_HOST e copie a pasta $LOCAL_DIR para $VPS_DIR"
    exit 1
}

log "Origem:  $LOCAL_DIR"
log "Destino: $VPS_HOST:$VPS_DIR"
echo ""

# ── Criar diretório no servidor se não existir ───────────────────
log "Garantindo diretório no servidor..."
ssh "$VPS_HOST" "mkdir -p $VPS_DIR"

# ── Transferência ─────────────────────────────────────────────────
log "Iniciando transferência (arquivos grandes podem demorar)..."

rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.next' \
    --exclude 'dist' \
    --exclude 'build' \
    --exclude '*.log' \
    --exclude 'backend/prisma/dev.db' \
    --exclude 'backend/prisma/dev.db-journal' \
    --exclude 'backend/.env' \
    --exclude 'frontend/.env.local' \
    "$LOCAL_DIR" \
    "$VPS_HOST:$VPS_DIR"

ok "Transferência concluída."

# ── Tornar scripts executáveis no servidor ────────────────────────
log "Tornando scripts executáveis no servidor..."
ssh "$VPS_HOST" "chmod +x $VPS_DIR/deploy.sh $VPS_DIR/vps-setup.sh 2>/dev/null || true"
ok "Permissões ajustadas."

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Arquivos transferidos com sucesso!                    ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Próximos passos:"
echo ""
echo "  1. PRIMEIRA VEZ — Setup inicial (SSL + nginx + containers):"
echo "     ssh $VPS_HOST \"cd $VPS_DIR && ./vps-setup.sh seu@email.com\""
echo ""
echo "  2. DEPLOYS SEGUINTES (após atualizar o código):"
echo "     ./transfer.sh && ssh $VPS_HOST \"cd $VPS_DIR && ./deploy.sh\""
echo ""
warn "Lembre-se: edite o backend/.env no servidor com as variáveis reais!"
warn "  ssh $VPS_HOST \"nano $VPS_DIR/backend/.env\""
echo ""
