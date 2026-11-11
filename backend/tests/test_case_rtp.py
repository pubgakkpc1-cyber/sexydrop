from app.core import catalog


def _rtp(entries, price):
    tw = sum(w for _i, w in entries)
    return sum(w * catalog._cost(i) for i, w in entries) / tw / price


def test_every_paid_case_hits_55_percent_or_its_minimum(monkeypatch):
    monkeypatch.setattr(catalog, "rtp_pct", lambda: 55)
    checked = 0
    for cid in catalog.case_ids():
        case = catalog.get_case(cid)
        if case.is_free:
            assert catalog.effective_entries(case) == catalog._admin_entries(case)  # FREE не трогаем
            continue
        eff = catalog.effective_entries(case)
        floor = min(catalog._cost(i) for i, _w in case.entries) / case.price
        assert abs(_rtp(eff, case.price) - max(0.55, floor)) < 0.012, (cid, _rtp(eff, case.price), floor)
        checked += 1
    assert checked > 20


def test_rarity_order_is_kept(monkeypatch):
    monkeypatch.setattr(catalog, "rtp_pct", lambda: 55)
    case = catalog.get_case("bronze")
    base = dict(catalog._admin_entries(case))
    eff = dict(catalog.effective_entries(case))
    # подгонка домножает вес на убывающую по цене величину: чем дороже приз, тем сильнее он режется относительно исходного веса
    pairs = sorted((catalog._cost(i), eff[i] / base[i]) for i in eff if base.get(i))
    assert all(pairs[k][1] >= pairs[k + 1][1] * 0.98 for k in range(len(pairs) - 1) if pairs[k][0] != pairs[k + 1][0])


def test_win_chance_is_capped_at_10_percent(monkeypatch):
    monkeypatch.setattr(catalog, "rtp_pct", lambda: 55)
    for cid in catalog.case_ids():
        case = catalog.get_case(cid)
        if case.is_free:
            continue
        eff = catalog.effective_entries(case)
        win = sum(w for i, w in eff if catalog._cost(i) > case.price) / sum(w for _i, w in eff)
        assert win <= 0.1005, (cid, win)
