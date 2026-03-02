param(
    [string]$dbName = "nexora_ag",
    [string]$dbUser = "postgres",
    [string]$dbPassword = "admin"
)

Write-Host "Nexora AG - Setup Script" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker status..." -ForegroundColor Yellow
docker ps | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Check if database exists, if not create it
Write-Host "Checking PostgreSQL database..." -ForegroundColor Yellow
$checkDb = docker exec nexora-postgres psql -U $dbUser -c "SELECT 1 FROM pg_database WHERE datname = '$dbName'" 2>&1

if ($checkDb -contains "0 rows") {
    Write-Host "Creating database $dbName..." -ForegroundColor Yellow
    docker exec nexora-postgres createdb -U $dbUser $dbName
    Write-Host "✅ Database created" -ForegroundColor Green
} else {
    Write-Host "✅ Database $dbName already exists" -ForegroundColor Green
}
Write-Host ""

# Run migrations
Write-Host "Running database migrations..." -ForegroundColor Yellow
cd ..\backend
npx prisma migrate deploy
Write-Host "✅ Migrations completed" -ForegroundColor Green
Write-Host ""

# Run seed
Write-Host "Running database seed..." -ForegroundColor Yellow
npx prisma db seed
Write-Host "✅ Seed completed" -ForegroundColor Green
Write-Host ""

# Start development server
Write-Host "Starting development server..." -ForegroundColor Yellow
Write-Host "🚀 Server will be available at http://localhost:3000" -ForegroundColor Green
Write-Host "📝 Swagger documentation at http://localhost:3000/api" -ForegroundColor Green
npm run start:dev
