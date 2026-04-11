from __future__ import annotations

from app.utils.domain_helpers import get_date_ranges


def test_date_ranges_match_streamlit_defaults() -> None:
    before_start, before_end, after_start, after_end = get_date_ranges("2023-08-01", gap_before=5, gap_after=5, window_days=10)
    assert before_start == "2023-07-17"
    assert before_end == "2023-07-27"
    assert after_start == "2023-08-06"
    assert after_end == "2023-08-16"
