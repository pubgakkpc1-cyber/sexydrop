import { spawn } from 'child_process';

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const proc = spawn(chrome, [
  '--headless=new',
  '--remote-debugging-port=9224',
  '--window-size=390,844',
  'http://127.0.0.1:4173/#/games/crash'
]);

setTimeout(async () => {
  try {
    const res = await fetch('http://127.0.0.1:9224/json');
    const tabs = await res.json();
    const appTab = tabs.find(t => t.url.includes('4173')) || tabs[0];
    const ws = new WebSocket(appTab.webSocketDebuggerUrl);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            const el = sel => document.querySelector(sel);
            const main = el('main');
            const screen = el('[class*="screen"]');
            const sub = el('[class*="subHeader"]');
            const subLeft = el('[class*="subLeft"]');
            const bal = el('[class*="balancePill"]');
            const getR = e => e ? { left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width } : null;
            return JSON.stringify({
              mainRect: getR(main),
              screenRect: getR(screen),
              subRect: getR(sub),
              subLeftRect: getR(subLeft),
              balRect: getR(bal)
            });
          })()`
        }
      }));
    };

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      console.log('MEASURE:', data.result.result.value);
      proc.kill();
      process.exit(0);
    };
  } catch (err) {
    console.error(err);
    proc.kill();
    process.exit(1);
  }
}, 2000);
