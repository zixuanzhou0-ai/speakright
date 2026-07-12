@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Speak Right Browser Edition

echo.
echo ========================================
echo   Speak Right Browser Edition
echo ========================================
echo.
echo Starting the local browser version...
echo Keep this window open while using Speak Right.
echo.

if not exist "package.json" (
  echo [ERROR] This is not the Speak Right Browser Edition folder.
  echo Please run this file from the folder that contains package.json.
  pause
  exit /b 1
)

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js LTS from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist "out\index.html" (
  echo [INFO] Static build was not found. Building Browser Edition now.
  where npm.cmd >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] npm was not found. Reinstall Node.js LTS with npm enabled.
    pause
    exit /b 1
  )
  if not exist "node_modules" (
    call npm.cmd install
    if errorlevel 1 (
      echo [ERROR] npm install failed.
      pause
      exit /b 1
    )
  )
  call npm.cmd run build
  if errorlevel 1 (
    echo [ERROR] Browser build failed.
    pause
    exit /b 1
  )
)

node.exe scripts\launch-browser-edition.mjs

echo.
echo Speak Right Browser server stopped.
pause