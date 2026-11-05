@echo off
setlocal
cd /d "%~dp0\.."
echo ======================================================== >> admin\daily_sync.log
echo [%DATE% %TIME%] Starting KYF Daily Market Data Sync... >> admin\daily_sync.log
py admin\sync_market_data.py --commit-push >> admin\daily_sync.log 2>&1
echo [%DATE% %TIME%] Finished KYF Daily Market Data Sync. >> admin\daily_sync.log
echo ======================================================== >> admin\daily_sync.log

