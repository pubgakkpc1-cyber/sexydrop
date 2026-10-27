import os
import subprocess

chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out_dir = os.path.abspath('scripts/test_cases')
os.makedirs(out_dir, exist_ok=True)

# 1. Countdown screen
cmd_countdown = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=440,900",
    "--virtual-time-budget=2000",
    f"--screenshot={os.path.join(out_dir, 'crash_screen_countdown.png')}",
    "http://127.0.0.1:4173/#/games/crash"
]
subprocess.run(cmd_countdown, check=True)

# 2. Flight screen
cmd_flight = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=440,900",
    "--virtual-time-budget=7200",
    f"--screenshot={os.path.join(out_dir, 'crash_screen_flight.png')}",
    "http://127.0.0.1:4173/#/games/crash"
]
subprocess.run(cmd_flight, check=True)

# 3. Crash screen
cmd_crash = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=440,900",
    "--virtual-time-budget=12500",
    f"--screenshot={os.path.join(out_dir, 'crash_screen_crashed.png')}",
    "http://127.0.0.1:4173/#/games/crash"
]
subprocess.run(cmd_crash, check=True)

print("Crash game screenshots (countdown, flight, crashed) taken successfully!")
