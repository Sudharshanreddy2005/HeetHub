from app.config import Settings
from app.moderation.ml import evaluate_model
from app.moderation.models import ModerationDecision
from app.moderation.service import classify_text


def test_model_evaluation_reports_precision_recall_and_f1() -> None:
    evaluation = evaluate_model()

    assert evaluation.samples > 0
    assert 0 <= evaluation.precision <= 1
    assert 0 <= evaluation.recall <= 1
    assert 0 <= evaluation.f1 <= 1


def test_ml_classifier_returns_safe_and_toxic_decisions() -> None:
    settings = Settings(jwt_secret="test-secret-with-at-least-32-bytes-long")

    safe = classify_text("Please share the meeting notes", settings)
    toxic = classify_text("You are an idiot", settings)

    assert safe.decision == ModerationDecision.SAFE
    assert toxic.decision in {ModerationDecision.WARNING, ModerationDecision.BLOCK}
    assert 0 <= safe.score <= 1
    assert 0 <= toxic.score <= 1


def test_lexical_fallback_can_be_disabled_to_force_safe_model_path() -> None:
    settings = Settings(jwt_secret="test-secret-with-at-least-32-bytes-long", toxicity_model_enabled=False)

    result = classify_text("You are an idiot and stupid", settings)

    assert result.decision == ModerationDecision.BLOCK


def test_model_failure_uses_lexical_fallback(monkeypatch) -> None:
    settings = Settings(jwt_secret="test-secret-with-at-least-32-bytes-long")
    monkeypatch.setattr("app.moderation.service.classify_with_model", lambda *_: (_ for _ in ()).throw(RuntimeError()))

    result = classify_text("You are an idiot and stupid", settings)

    assert result.decision == ModerationDecision.BLOCK


def test_classifier_accepts_long_and_unicode_text() -> None:
    settings = Settings(jwt_secret="test-secret-with-at-least-32-bytes-long")

    result = classify_text("नमस्ते " + "great work " * 200, settings)

    assert result.decision == ModerationDecision.SAFE
