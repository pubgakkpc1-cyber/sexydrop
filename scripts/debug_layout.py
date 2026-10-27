import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_argument('--headless=new')
options.add_argument('--window-size=390,844')
driver = webdriver.Chrome(options=options)
driver.get('http://127.0.0.1:4173/#/games/crash')

script = """
const sub = document.querySelector('[class*="subHeader"]');
const bal = document.querySelector('[class*="balancePill"]');
const screen = document.querySelector('[class*="screen"]');
const main = document.querySelector('main');
const shell = document.querySelector('[class*="shellContainer"]');
return {
  shellWidth: shell ? shell.offsetWidth : null,
  mainWidth: main ? main.offsetWidth : null,
  screenWidth: screen ? screen.offsetWidth : null,
  subWidth: sub ? sub.offsetWidth : null,
  balRect: bal ? { left: bal.getBoundingClientRect().left, right: bal.getBoundingClientRect().right, width: bal.getBoundingClientRect().width } : null,
  windowWidth: window.innerWidth
};
"""
info = driver.execute_script(script)
print(json.dumps(info, indent=2))
driver.quit()
