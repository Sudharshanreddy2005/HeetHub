from dataclasses import dataclass
import logging

from ..config import Settings
from .ml import classify_with_model
from .models import ModerationDecision


@dataclass(frozen=True)
class ToxicityResult:
    score: float
    decision: ModerationDecision


# Phase 7 baseline: deliberately conservative phrase matching, replaceable by a
# measured model after evaluation and documentation.
TOXIC_TERMS = frozenset({"idiot", "stupid", "shut up", "hate you"})
logger = logging.getLogger(__name__)


def classify_text(content: str, settings: Settings) -> ToxicityResult:
    return _classify(content, settings, settings.toxicity_warning_threshold, settings.toxicity_block_threshold)


def classify_voice_transcript(content: str, settings: Settings) -> ToxicityResult:
    """Classify a temporary voice transcript using independently configurable thresholds."""
    return _classify(
        content,
        settings,
        settings.voice_toxicity_warning_threshold,
        settings.voice_toxicity_block_threshold,
    )


def _classify(content: str, settings: Settings, warning_threshold: float, block_threshold: float) -> ToxicityResult:
    if settings.toxicity_model_enabled:
        try:
            model_score, _ = classify_with_model(content, settings)
            lexical_score = _lexical_score(content)
            score = max(model_score, lexical_score)
            if score >= block_threshold:
                decision = ModerationDecision.BLOCK
            elif score >= warning_threshold:
                decision = ModerationDecision.WARNING
            else:
                decision = ModerationDecision.SAFE
            return ToxicityResult(score=score, decision=decision)
        except Exception as error:
            # The fallback is intentionally available for model failures, but
            # model outages must remain visible to operators without logging
            # user-provided message content.
            logger.warning("Toxicity model inference failed; using lexical fallback (%s)", type(error).__name__)

    score = _lexical_score(content)
    if score >= block_threshold:
        decision = ModerationDecision.BLOCK
    elif score >= warning_threshold:
        decision = ModerationDecision.WARNING
    else:
        decision = ModerationDecision.SAFE
    return ToxicityResult(score=score, decision=decision)


def _lexical_score(content: str) -> float:
    normalized = content.casefold()
    matches = sum(term in normalized for term in TOXIC_TERMS)
    return min(matches * 0.5, 1.0)
