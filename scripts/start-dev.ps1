Write-Host "Starting Nexora AG Development Server..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to backend
cd ..\backend

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please update .env with your configuration" -ForegroundColor Yellow
    exit 1
}

# Run migrations
Write-Host "Running migrations..." -ForegroundColor Yellow
npx prisma migrate deploy

# Start server
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host "🚀 Server will be available at http://localhost:3000" -ForegroundColor Green
Write-Host "📝 Swagger documentation at http://localhost:3000/api" -ForegroundColor Green
npm run start:dev
