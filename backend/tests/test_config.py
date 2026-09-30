import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_reject_invalid_toxicity_threshold_order() -> None:
    with pytest.raises(ValidationError):
        Settings(
            jwt_secret="test-secret-with-at-least-32-bytes-long",
            toxicity_warning_threshold=0.9,
            toxicity_block_threshold=0.8,
        )


@pytest.mark.parametrize("field", ["voice_rate_limit_per_minute", "voice_transcript_max_length"])
def test_settings_reject_non_positive_voice_limits(field: str) -> None:
    with pytest.raises(ValidationError):
        Settings(jwt_secret="test-secret-with-at-least-32-bytes-long", **{field: 0})