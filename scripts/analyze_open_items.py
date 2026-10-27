import json

with open('scripts/open_items.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

print('Total:', len(items))

# Chests
chests = [i for i in items if i['cat'] == 'treasure_chest' and 'open' in i['alt'].lower()]
print('Open chests:', len(chests))
for c in chests[:20]:
    print('  ', c['alt'], '->', c['src'])

# Gifts
gifts = [i for i in items if i['cat'] == 'gift' and 'open' in i['alt'].lower()]
print('\nOpen gifts:', len(gifts))
for g in gifts:
    print('  ', g['alt'], '->', g['src'])

# Boxes
boxes = [i for i in items if i['cat'] == 'box' and 'open' in i['alt'].lower()]
print('\nOpen boxes:', len(boxes))
for b in boxes[:15]:
    print('  ', b['alt'], '->', b['src'])
