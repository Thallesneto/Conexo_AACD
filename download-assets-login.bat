@echo off
rem Baixa os assets NOVOS da Tela de Login (Figma, no 30:3).
rem Logo CoNexo, logo Maua, logo AACD e linha divisoria ja foram baixados pelo
rem download-assets.bat e sao reaproveitados.
rem Execute na pasta que contem login.html:  download-assets-login.bat

set "P=https://www.figma.com/api/mcp/asset/0fd08d27-345f-48fc-a55f-3ef35ed58c13"

if not exist assets\images mkdir assets\images
if not exist assets\icons mkdir assets\icons

rem Imagem (PNG)
curl.exe -fL -o assets\images\login-hero.png        "%P%/85b19.png"

rem Icones e padrao (SVG)
curl.exe -fL -o assets\icons\login-pattern.svg      "%P%/e9091.svg"
curl.exe -fL -o assets\icons\icon-email.svg         "%P%/47982.svg"
curl.exe -fL -o assets\icons\icon-password-eye.svg  "%P%/897a4.svg"
curl.exe -fL -o assets\icons\icon-lock.svg          "%P%/95468.svg"
curl.exe -fL -o assets\icons\icon-arrow-back.svg    "%P%/25a38.svg"

echo.
echo Arquivos em assets:
dir /s /b assets
pause
