from app.core import catalog


def _rtp(entries, price):
    tw = sum(w for _i, w in entries)
    return sum(w * catalog._cost(i) for i, w in entries) / tw / price


def _paid(monkeypatch):
    monkeypatch.setattr(catalog, "rtp_pct", lambda: 60)
    for cid in catalog.case_ids():
        case = catalog.get_case(cid)
        if not case.is_free:
            yield case


def test_free_cases_are_untouched(monkeypatch):
    monkeypatch.setattr(catalog, "rtp_pct", lambda: 60)
    for cid in catalog.case_ids():
        case = catalog.get_case(cid)
        if case.is_free:
            assert catalog.effective_entries(case) == catalog._admin_entries(case)


def test_every_paid_case_hits_60_percent_or_its_minimum(monkeypatch):
    checked = 0
    for case in _paid(monkeypatch):
        eff = catalog.effective_entries(case)
        floor = min(catalog._cost(i) for i, _w in eff) / case.price
        got = _rtp(eff, case.price)
        assert got >= min(0.60, floor) - 0.012, (case.id, got)
        if case.id not in ("autumn", "onyx-black"):  # в этих кейсах слишком дорогие призы: 60% недостижимо
            assert abs(got - 0.60) < 0.012, (case.id, got)
        checked += 1
    assert checked > 20


def test_win_chance_is_capped_at_10_percent(monkeypatch):
    for case in _paid(monkeypatch):
        eff = catalog.effective_entries(case)
        win = sum(w for i, w in eff if catalog._cost(i) > case.price) / sum(w for _i, w in eff)
        assert win <= 0.1005, (case.id, win)


def test_at_most_four_items_below_case_price(monkeypatch):
    for case in _paid(monkeypatch):
        losing = [i for i, _w in catalog.effective_entries(case) if catalog._cost(i) < case.price]
        assert len(losing) <= catalog.MAX_LOSING_ITEMS, (case.id, len(losing))


def test_ton_prizes_only_in_small_cases(monkeypatch):
    for case in _paid(monkeypatch):
        if case.price < catalog.TON_PRIZE_MAX_CASE:
            continue
        no_ton = [i for i, _w in catalog._admin_entries(case) if not catalog.is_ton_prize(i) and catalog._cost(i) < case.price]
        if no_ton:  # есть чем заменить дешёвую часть — TON-призов быть не должно
            assert not any(catalog.is_ton_prize(i) for i, _w in catalog.effective_entries(case)), case.id


def test_rarity_order_is_kept(monkeypatch):
    monkeypatch.setattr(catalog, "rtp_pct", lambda: 60)
    case = catalog.get_case("bronze")
    base = dict(catalog.shape_entries(catalog._admin_entries(case), case.price))
    eff = dict(catalog.effective_entries(case))
    pairs = sorted((catalog._cost(i), eff[i] / base[i]) for i in eff if base.get(i))
    assert all(pairs[k][1] >= pairs[k + 1][1] * 0.98 for k in range(len(pairs) - 1) if pairs[k][0] != pairs[k + 1][0])


def test_at_most_three_ton_prizes_and_only_below_gifts(monkeypatch):
    for case in _paid(monkeypatch):
        eff = catalog.effective_entries(case)
        tons = [i for i, _w in eff if catalog.is_ton_prize(i)]
        gifts = [catalog._cost(i) for i, _w in eff if not catalog.is_ton_prize(i)]
        assert len(tons) <= catalog.MAX_TON_PRIZES, (case.id, len(tons))
        if gifts:
            assert all(catalog._cost(i) < min(gifts) for i in tons), case.id
