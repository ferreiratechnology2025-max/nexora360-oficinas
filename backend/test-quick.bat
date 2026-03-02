@echo off
echo === Teste Rápido do Backend ===
echo.
echo 1. Compilando o projeto...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERRO NA COMPILAÇÃO!
    pause
    exit /b 1
)
echo.
echo 2. Iniciando servidor de desenvolvimento...
echo.
echo Abra o Postman e siga os testes em TESTES_POSTMAN.md
echo.
call npm run start:dev
pause
