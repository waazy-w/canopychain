import json

from eth_hash.auto import keccak

from app.methodology import avoided_loss_ha, canonical_json, credits_for, lost_credits, report_hash


def test_example_from_api_doc():
    # 1180.2 ha × 2.1% = 24.78 ha expected loss, minus 3.3 ha observed
    avoided = avoided_loss_ha(1180.2, 2.1, 3.3)
    assert round(avoided, 4) == 21.4842
    assert credits_for(avoided, 450) == 9668


def test_avoided_loss_floors_at_zero():
    assert avoided_loss_ha(100, 2.1, 50) == 0.0
    assert credits_for(0.0, 450) == 0


def test_lost_credits():
    assert lost_credits(10.004, 450) == 4502
    assert lost_credits(-1, 450) == 0


def test_hash_is_keccak_of_sorted_compact_json_without_tx_fields():
    report = {"b": 1, "a": {"y": "é", "x": 2.5}, "reportHash": "0xold", "txHash": "0x1", "onChainError": None, "lostCredits": 7}
    expected_body = json.dumps({"a": {"x": 2.5, "y": "é"}, "b": 1}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    assert canonical_json(report) == expected_body.encode("utf-8")
    assert canonical_json(report) == '{"a":{"x":2.5,"y":"é"},"b":1}'.encode("utf-8")
    assert report_hash(report) == "0x" + keccak(expected_body.encode("utf-8")).hex()


def test_canonical_json_matches_javascript_number_format():
    # JSON.stringify writes 450.0 as 450 and 0.0 as 0; non-integral floats are unchanged.
    report = {"tco2ePerHa": 450.0, "nested": [0.0, 2.5, {"ha": 1180.0}], "n": 3}
    assert canonical_json(report) == b'{"n":3,"nested":[0,2.5,{"ha":1180}],"tco2ePerHa":450}'


def test_hash_ignores_key_order_and_unhashed_fields():
    a = {"x": 1, "y": [1, 2]}
    b = {"y": [1, 2], "x": 1, "txHash": "0xabc", "reportHash": "0xdef"}
    assert report_hash(a) == report_hash(b)
    assert report_hash(a) != report_hash({"x": 2, "y": [1, 2]})
    assert len(report_hash(a)) == 66
