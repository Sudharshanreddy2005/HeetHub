import logging
import logging.config
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import MongoConnection
from .auth.router import router as auth_router
from .meetings.router import router as meetings_router
from .chat.router import router as chat_router
from .moderation.router import router as moderation_router
from .voice.router import router as voice_router


def configure_logging() -> None:
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {"default": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
            "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "default"}},
            "root": {"level": "INFO", "handlers": ["console"]},
        }
    )


configure_logging()
settings = get_settings()
database = MongoConnection(settings)


@asynccontextmanager
async def lifespan(_: FastAPI):
    async for _ in database.lifespan():
        yield


app = FastAPI(title="AI Secure Meeting API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    # Browser clients use JSON POST/PATCH requests for authenticated meeting
    # actions. Restrict origins, but allow the documented API methods through
    # CORS preflight rather than leaving the browser unable to use them.
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(meetings_router)
app.include_router(chat_router)
app.include_router(moderation_router)
app.include_router(voice_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
