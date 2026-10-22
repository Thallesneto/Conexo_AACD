@echo off
rem Baixa os assets originais da Tela Sobre Nos (Figma, no 30:4) para assets\
rem Execute na pasta que contem index.html:  download-assets.bat

set "P=https://www.figma.com/api/mcp/asset/c9a5bfec-0e58-4225-907f-027d7d0696ad"

if not exist assets\images mkdir assets\images
if not exist assets\icons mkdir assets\icons

rem Imagens (PNG)
curl.exe -fL -o assets\images\logo-conexo.png     "%P%/d9a80.png"
curl.exe -fL -o assets\images\logo-maua-mask.png  "%P%/b9aaf.png"
curl.exe -fL -o assets\images\logo-aacd.png       "%P%/58024.png"

rem Icones (SVG)
curl.exe -fL -o assets\icons\icon-stethoscope.svg   "%P%/0ab09.svg"
curl.exe -fL -o assets\icons\icon-3d-cube.svg       "%P%/eb191.svg"
curl.exe -fL -o assets\icons\icon-collaboration.svg "%P%/0dbf1.svg"
curl.exe -fL -o assets\icons\icon-target.svg        "%P%/17389.svg"
curl.exe -fL -o assets\icons\icon-pillar-footer.svg "%P%/8a9c5.svg"
curl.exe -fL -o assets\icons\icon-eye.svg           "%P%/4f1fe.svg"
curl.exe -fL -o assets\icons\icon-heart-shield.svg  "%P%/6fbe7.svg"
curl.exe -fL -o assets\icons\icon-partnership.svg   "%P%/a31f6.svg"
curl.exe -fL -o assets\icons\divider-line.svg       "%P%/5049d.svg"

echo.
echo Arquivos em assets:
dir /s /b assets
pause
