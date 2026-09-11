@echo off
rem ===========================================================================
rem   Minecraft Server - Debug Launcher
rem
rem   The single entry point for all dev / debug operations.
rem
rem   All real logic lives in scripts\dev.mjs (Node, cross-platform).
rem   This file only: switches code page, cds here, checks Node, forwards args,
rem   and keeps the window open so failures stay readable.
rem
rem   Usage:
rem     debug.bat                      interactive menu (double-click)
rem     debug.bat up                   start everything (check -> db -> migrate -> dev)
rem     debug.bat up --seed            same, plus seed data
rem     debug.bat dev                  dev server only
rem     debug.bat build / start        production build / serve
rem     debug.bat check                environment doctor
rem     debug.bat preflight            tsc + eslint + i18n + unit tests
rem     debug.bat test                 unit tests only
rem     debug.bat backup               back up the database (pg_dump + rotation)
rem     debug.bat cleanup              prune expired rows (codes / counters)
rem     debug.bat info                 project / environment info
rem     debug.bat mail:test [email]    SMTP self-check
rem     debug.bat mail:preview <email> preview the verification-code email
rem     debug.bat users                user manager / force login (interactive)
rem     debug.bat users:list           list all users
rem     debug.bat adduser <name> [--admin] [--uuid <UUID>]
rem     debug.bat session <name>       generate a debug session cookie
rem     debug.bat makeadmin <name>     promote to admin + session cookie
rem     debug.bat help                 full command list
rem
rem   Anything `node scripts/dev.mjs` accepts works here too - args are
rem   forwarded verbatim, so db:* and friends are available as well.
rem
rem   Two batch-file landmines this file deliberately avoids:
rem
rem   1. ASCII ONLY. cmd.exe loses byte sync when a batch file contains
rem      multi-byte characters after `chcp 65001`, and starts executing
rem      fragments of comment lines. All Chinese UI text comes from dev.mjs
rem      instead (Node handles UTF-8 correctly).
rem
rem   2. NO nested parenthesised blocks around set/if. Inside `( ... )`,
rem      %VAR% is expanded when the block is PARSED, not when it runs, so
rem      `set /p X=...` followed by `if "%X%"==...` in the same block always
rem      compares against the old value. `goto` labels sidestep it entirely.
rem ===========================================================================

setlocal enableextensions
chcp 65001 >nul 2>&1
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto :no_node

if not exist "node_modules\" goto :no_deps

goto :run

rem ---------------------------------------------------------------------------
:no_node
echo.
echo   [X] Node.js not found.
echo.
echo       Install Node.js 20.9 or newer: https://nodejs.org/
echo       Then reopen this window.
echo.
pause
exit /b 1

rem ---------------------------------------------------------------------------
:no_deps
echo.
echo   [!] Dependencies are not installed ^(node_modules is missing^).
echo.
set /p "ANSWER=      Run npm install now? [Y/n] "
if /i "%ANSWER%"=="n" goto :skip_install

echo.
echo   ^> npm install
call npm install
if errorlevel 1 goto :install_failed
goto :run

:skip_install
echo.
echo       Skipped. Most commands need dependencies to run.
goto :run

:install_failed
echo.
echo   [X] npm install failed. Check your network and try again.
echo.
pause
exit /b 1

rem ---------------------------------------------------------------------------
rem  No args  -> interactive menu, always pause at the end so the output stays.
rem  With args -> pass through verbatim; pause only when it failed.
rem ---------------------------------------------------------------------------
:run
if "%~1"=="" goto :menu

node "scripts\dev.mjs" %*
set "EXITCODE=%ERRORLEVEL%"
if "%EXITCODE%"=="0" exit /b 0

echo.
echo   [X] Command exited with code %EXITCODE%.
pause
exit /b %EXITCODE%

:menu
node "scripts\dev.mjs"
set "EXITCODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXITCODE%
