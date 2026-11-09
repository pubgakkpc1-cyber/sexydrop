from app.core import catalog


def _rtp(entries, price):
    tw = sum(w for _i, w in entries)
    return sum(w * catalog._cost(i) for i, w in entries) / tw / price


def test_every_paid_case_hits_40_percent_or_its_minimum(monkeypatch):
    monkeypatch.setattr(catalog, "rtp_pct", lambda: 40)
    checked = 0
    for cid in catalog.case_ids():
        case = catalog.get_case(cid)
        if case.is_free:
            assert catalog.effective_entries(case) == catalog._admin_entries(case)  # FREE не трогаем
            continue
        eff = catalog.effective_entries(case)
        floor = min(catalog._cost(i) for i, _w in case.entries) / case.price
        assert abs(_rtp(eff, case.price) - max(0.40, floor)) < 0.012, (cid, _rtp(eff, case.price), floor)
        checked += 1
    assert checked > 20


def test_rarity_order_is_kept(monkeypatch):
    monkeypatch.setattr(catalog, "rtp_pct", lambda: 40)
    case = catalog.get_case("bronze")
    eff = dict(catalog.effective_entries(case))
    pairs = sorted(((catalog._cost(i), w) for i, w in eff.items()))
    # чем дороже приз, тем не чаще он выпадает (с небольшой погрешностью округления)
    assert all(pairs[k][1] >= pairs[k + 1][1] - 2 for k in range(len(pairs) - 1) if pairs[k][0] != pairs[k + 1][0])
