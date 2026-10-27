import urllib.request, json, subprocess, time, websocket

chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
proc = subprocess.Popen([
    chrome,
    '--headless=new',
    '--remote-debugging-port=9223',
    '--window-size=390,844',
    'http://127.0.0.1:4173/#/games/crash'
])
time.sleep(2)

try:
    tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9223/json').read())
    ws_url = tabs[0]['webSocketDebuggerUrl']
    ws = websocket.create_connection(ws_url)
    
    msg = json.dumps({
        'id': 1,
        'method': 'Runtime.evaluate',
        'params': {
            'expression': '''
                (() => {
                    const el = (sel) => document.querySelector(sel);
                    const allOver = [];
                    document.querySelectorAll('*').forEach(node => {
                        if (node.scrollWidth > node.clientWidth + 2) {
                            allOver.push({ tag: node.tagName, class: node.className, sw: node.scrollWidth, cw: node.clientWidth });
                        }
                    });
                    return JSON.stringify({
                        windowInnerWidth: window.innerWidth,
                        docClientWidth: document.documentElement.clientWidth,
                        mainWidth: el('main') ? el('main').offsetWidth : null,
                        mainScrollWidth: el('main') ? el('main').scrollWidth : null,
                        overflowing: allOver.slice(0, 5)
                    });
                })()
            '''
        }
    })
    ws.send(msg)
    res = json.loads(ws.recv())
    print('DOM Evaluation Result:', res['result']['result']['value'])
    ws.close()
finally:
    proc.terminate()
