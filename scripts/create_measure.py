import os

html = """
<!DOCTYPE html>
<html>
<body>
<script>
window.addEventListener('load', async () => {
  const f = document.createElement('iframe');
  f.src = 'http://127.0.0.1:4173/#/case/farm';
  f.style.width = '390px';
  f.style.height = '844px';
  f.style.border = 'none';
  document.body.appendChild(f);
  f.onload = () => {
    setTimeout(() => {
      const doc = f.contentDocument;
      const screen = doc.querySelector('[class*="screen"]');
      const nav = doc.querySelector('header');
      const res = {
        docClientW: doc.documentElement.clientWidth,
        docScrollW: doc.documentElement.scrollWidth,
        bodyClientW: doc.body.clientWidth,
        bodyScrollW: doc.body.scrollWidth,
        screenClientW: screen ? screen.clientWidth : null,
        screenScrollW: screen ? screen.scrollWidth : null,
        navClientW: nav ? nav.clientWidth : null,
        navScrollW: nav ? nav.scrollWidth : null,
      };
      const p = document.createElement('pre');
      p.id = 'metrics';
      p.textContent = JSON.stringify(res, null, 2);
      document.body.appendChild(p);
    }, 1500);
  };
});
</script>
</body>
</html>
"""

with open('scripts/test_cases/measure.html', 'w', encoding='utf-8') as f:
    f.write(html)
