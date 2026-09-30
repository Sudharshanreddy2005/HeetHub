from dataclasses import dataclass
from functools import lru_cache

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from ..config import Settings
from .models import ModerationDecision


TRAINING_TEXTS = [
    "you are an idiot", "that was stupid", "shut up", "i hate you", "you are worthless",
    "go away idiot", "what a stupid idea", "you are terrible", "stop being an idiot", "this is a stupid plan",
    "please shut up now", "i really hate you", "you sound worthless", "that answer is idiotic", "what a terrible person",
    "thanks for your help", "good morning everyone", "let us review the plan", "that is a useful suggestion",
    "could you explain that again", "i agree with this approach", "great work team", "please send the notes",
    "thank you for explaining", "let us solve this together", "your feedback is helpful", "the meeting went well",
    "please clarify the requirement", "i support this proposal", "nice work on the report", "can we discuss this calmly",
]
TRAINING_LABELS = [1] * 15 + [0] * 16


@dataclass(frozen=True)
class ModelEvaluation:
    precision: float
    recall: float
    f1: float
    samples: int


def build_model() -> Pipeline:
    model = Pipeline([
        ("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), sublinear_tf=True)),
        ("classifier", LogisticRegression(random_state=42, max_iter=1000, class_weight="balanced")),
    ])
    model.fit(TRAINING_TEXTS, TRAINING_LABELS)
    return model


@lru_cache
def get_model() -> Pipeline:
    return build_model()


def evaluate_model() -> ModelEvaluation:
    train_texts, test_texts, train_labels, test_labels = train_test_split(
        TRAINING_TEXTS, TRAINING_LABELS, test_size=0.25, random_state=42, stratify=TRAINING_LABELS
    )
    model = Pipeline([
        ("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), sublinear_tf=True)),
        ("classifier", LogisticRegression(random_state=42, max_iter=1000, class_weight="balanced")),
    ])
    model.fit(train_texts, train_labels)
    predictions = model.predict(test_texts)
    return ModelEvaluation(
        precision=precision_score(test_labels, predictions, zero_division=0),
        recall=recall_score(test_labels, predictions, zero_division=0),
        f1=f1_score(test_labels, predictions, zero_division=0),
        samples=len(test_labels),
    )


def classify_with_model(content: str, settings: Settings) -> tuple[float, ModerationDecision]:
    score = float(get_model().predict_proba([content])[0][1])
    if score >= settings.toxicity_block_threshold:
        decision = ModerationDecision.BLOCK
    elif score >= settings.toxicity_warning_threshold:
        decision = ModerationDecision.WARNING
    else:
        decision = ModerationDecision.SAFE
    return score, decision
