@echo off
:: Protocolo de Elevacao de Privilegios J.A.R.V.I.S.
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Solicitando privilegios de administrador, Senhor...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    cd /d "%~dp0"

title J.A.R.V.I.S. - Stark Industries Launcher
color 0B

echo ========================================================
echo   INICIANDO SISTEMA J.A.R.V.I.S. - ESTILO TONY STARK
echo ========================================================
echo Status: Privilegios de Administrador Confirmados.
echo.

echo [1/3] Limpando processos anteriores na porta 3000...
for /f "tokens=5" %%a in ('netstat -a -n -o ^| findstr :3000') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/3] Verificando dependencias...
if not exist "node_modules" (
    echo Instalando dependencias pela primeira vez...
    call npm install
)

echo [3/3] Iniciando o servidor J.A.R.V.I.S....
echo Acesse no navegador: http://localhost:3000
echo --------------------------------------------------------
npm run dev
pause
