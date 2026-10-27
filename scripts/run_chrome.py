import subprocess
import time

cmd = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "--remote-debugging-port=9222",
    "--remote-allow-origins=*",
    r"--user-data-dir=C:\Users\pc\AppData\Local\Google\Chrome\User Data Debug",
    "--profile-directory=Profile 3",
    "https://app.northflank.com/t/sexydrops-team"
]

print("Starting Chrome daemon on port 9222...")
proc = subprocess.Popen(cmd)
while True:
    if proc.poll() is not None:
        print("Chrome exited with code", proc.poll())
        break
    time.sleep(1)
