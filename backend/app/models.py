from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Feedback(Base):
    """One piece of user feedback. Stores only what the user chose to submit:
    no IP address, no user agent, no page URL, no account."""

    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    useful: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    pronunciation_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    suggested_pronunciation: Mapped[str | None] = mapped_column(String(200), nullable=True)
    suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    delete_token_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
