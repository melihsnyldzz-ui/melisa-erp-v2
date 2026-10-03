param(
  [ValidatePattern('^[a-z0-9-]+$')][string]$Label = 'screen',
  [string]$Adb = "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
)
$ErrorActionPreference = 'Stop'
$taskAdb = $Adb
$taskOutput = Join-Path $PSScriptRoot '../../temp/emulator'
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
# Fixed isolated emulator serial: never fall back to the user's physical device.
& $taskAdb -s emulator-5580 shell uiautomator dump /sdcard/commerce-window.xml | Out-Null
& $taskAdb -s emulator-5580 pull /sdcard/commerce-window.xml "$taskOutput/$Label.xml" | Out-Null
& $taskAdb -s emulator-5580 shell screencap -p /sdcard/commerce-screen.png
& $taskAdb -s emulator-5580 pull /sdcard/commerce-screen.png "$taskOutput/$Label.png" | Out-Null
[xml]$taskUi = Get-Content -Raw "$taskOutput/$Label.xml"
$taskUi.SelectNodes('//node[@text!="" or @class="android.widget.EditText"]') | ForEach-Object {
  '{0} | {1} | {2} | focused={3}' -f $_.text, $_.class, $_.bounds, $_.focused
}
