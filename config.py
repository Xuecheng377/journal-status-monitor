"""Configuration for the journal status monitor."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable


TRUE_VALUES = {"1", "true", "yes", "y", "on"}
MAX_PLATFORM_SLOTS = 5


def first_env(*names: str, default: str | None = None) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return default


def bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in TRUE_VALUES


def int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer, got {value!r}") from exc


def split_recipients(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.replace(";", ",").split(",") if item.strip()]


def split_statuses(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip().lower() for item in value.replace(";", ",").split(",") if item.strip()]


@dataclass(frozen=True)
class PlatformAccount:
    name: str
    email: str | None
    password: str | None
    url: str | None

    @property
    def configured(self) -> bool:
        return bool(self.email and self.password and self.url)

    @property
    def partially_configured(self) -> bool:
        return any([self.email, self.password, self.url]) and not self.configured


def platform_slot_names(prefix: str, slot: int) -> tuple[str, str, str]:
    env_prefix = prefix if slot == 1 else f"{prefix}_{slot}"
    return f"{env_prefix}_EMAIL", f"{env_prefix}_PASSWORD", f"{env_prefix}_URL"


def read_platform_account(name: str, prefix: str, slot: int) -> PlatformAccount:
    email_name, password_name, url_name = platform_slot_names(prefix, slot)
    if slot == 1:
        email = first_env(email_name, f"{prefix}_USERNAME")
    else:
        email = first_env(email_name, f"{prefix}_{slot}_USERNAME")
    return PlatformAccount(
        name,
        email,
        first_env(password_name),
        first_env(url_name),
    )


class Config:
    # Accept both documented *_EMAIL names and older *_USERNAME aliases.
    IEEE_EMAIL = first_env("IEEE_EMAIL", "IEEE_USERNAME")
    IEEE_USERNAME = IEEE_EMAIL
    IEEE_PASSWORD = first_env("IEEE_PASSWORD")
    IEEE_URL = first_env("IEEE_URL")

    ELSEVIER_EMAIL = first_env("ELSEVIER_EMAIL", "ELSEVIER_USERNAME")
    ELSEVIER_USERNAME = ELSEVIER_EMAIL
    ELSEVIER_PASSWORD = first_env("ELSEVIER_PASSWORD")
    ELSEVIER_URL = first_env("ELSEVIER_URL")

    EMAIL_SENDER = first_env("EMAIL_SENDER")
    EMAIL_PASSWORD = first_env("EMAIL_PASSWORD")
    EMAIL_RECEIVER = first_env("EMAIL_RECEIVER", "EMAIL_RECIPIENTS")
    EMAIL_RECEIVERS = split_recipients(EMAIL_RECEIVER)

    SMTP_SERVER = first_env("SMTP_SERVER", "SMTP_HOST")
    SMTP_PORT = int_env("SMTP_PORT", 0)

    DATA_FILE = first_env("DATA_FILE", default="data/manuscripts.json") or "data/manuscripts.json"
    RETENTION_DAYS = int_env("RETENTION_DAYS", 30)
    HEADLESS = bool_env("HEADLESS", True)
    FAIL_ON_EMPTY = bool_env("FAIL_ON_EMPTY", False)
    SAVE_DEBUG_ARTIFACTS = bool_env("SAVE_DEBUG_ARTIFACTS", True)
    DEBUG_DIR = first_env("DEBUG_DIR", default="debug") or "debug"
    WAIT_SECONDS = int_env("WAIT_SECONDS", 20)
    PAGE_LOAD_TIMEOUT = int_env("PAGE_LOAD_TIMEOUT", 60)

    ARCHIVE_TERMINAL = bool_env("ARCHIVE_TERMINAL", True)
    INCLUDE_ARCHIVED_IN_REPORT = bool_env("INCLUDE_ARCHIVED_IN_REPORT", False)
    TERMINAL_STATUS_KEYWORDS = split_statuses(
        first_env(
            "TERMINAL_STATUS_KEYWORDS",
            default=(
                "accept,accepted,acceptance,published,online,final decision,"
                "reject,rejected,declined,withdrawn,transferred,completed"
            ),
        )
    )

    @classmethod
    def ieee_account(cls) -> PlatformAccount:
        return read_platform_account("IEEE", "IEEE", 1)

    @classmethod
    def elsevier_account(cls) -> PlatformAccount:
        return read_platform_account("Elsevier", "ELSEVIER", 1)

    @classmethod
    def platform_accounts(cls) -> list[PlatformAccount]:
        accounts: list[PlatformAccount] = []
        for slot in range(1, MAX_PLATFORM_SLOTS + 1):
            accounts.append(read_platform_account("IEEE", "IEEE", slot))
        for slot in range(1, MAX_PLATFORM_SLOTS + 1):
            accounts.append(read_platform_account("Elsevier", "ELSEVIER", slot))
        return accounts

    @classmethod
    def configured_platforms(cls) -> list[PlatformAccount]:
        return [account for account in cls.platform_accounts() if account.configured]

    @classmethod
    def get_smtp_config(cls) -> tuple[str, int]:
        host = cls.SMTP_SERVER or cls.guess_smtp_host(cls.EMAIL_SENDER)
        port = cls.SMTP_PORT or cls.default_smtp_port(host)
        return host, port

    @staticmethod
    def guess_smtp_host(sender: str | None) -> str:
        if not sender or "@" not in sender:
            return ""
        domain = sender.rsplit("@", 1)[1].lower()
        known = {
            "qq.com": "smtp.qq.com",
            "foxmail.com": "smtp.qq.com",
            "163.com": "smtp.163.com",
            "126.com": "smtp.126.com",
            "yeah.net": "smtp.yeah.net",
            "gmail.com": "smtp.gmail.com",
            "outlook.com": "smtp.office365.com",
            "hotmail.com": "smtp.office365.com",
            "live.com": "smtp.office365.com",
            "sina.com": "smtp.sina.com",
        }
        return known.get(domain, f"smtp.{domain}")

    @staticmethod
    def default_smtp_port(host: str) -> int:
        if host in {"smtp.qq.com", "smtp.163.com", "smtp.126.com", "smtp.gmail.com"}:
            return 465
        return 587

    @classmethod
    def is_terminal_status(cls, status: object) -> bool:
        if not cls.ARCHIVE_TERMINAL:
            return False
        text = str(status or "").strip().lower()
        if not text:
            return False
        return any(keyword in text for keyword in cls.TERMINAL_STATUS_KEYWORDS)

    @classmethod
    def validate(cls, mode: str) -> None:
        errors: list[str] = []

        if mode in {"normal", "daily_report"}:
            if not cls.configured_platforms():
                errors.append(
                    "Configure at least one full platform account: IEEE_EMAIL/IEEE_PASSWORD/IEEE_URL "
                    "or ELSEVIER_EMAIL/ELSEVIER_PASSWORD/ELSEVIER_URL."
                )
            for account in cls.platform_accounts():
                if account.partially_configured:
                    errors.append(f"{account.name} settings are incomplete; email, password, and URL are all required.")

        if mode in {"test", "normal", "daily_report"}:
            if not cls.EMAIL_SENDER:
                errors.append("EMAIL_SENDER is required.")
            if not cls.EMAIL_PASSWORD:
                errors.append("EMAIL_PASSWORD is required.")
            if not cls.EMAIL_RECEIVERS:
                errors.append("EMAIL_RECEIVER is required.")
            smtp_host, _ = cls.get_smtp_config()
            if not smtp_host:
                errors.append("SMTP_SERVER/SMTP_HOST is required when SMTP cannot be inferred from EMAIL_SENDER.")

        if errors:
            raise RuntimeError("Configuration is invalid:\n - " + "\n - ".join(errors))

    @classmethod
    def summary(cls, accounts: Iterable[PlatformAccount]) -> str:
        names = ", ".join(account.name for account in accounts) or "none"
        smtp_host, smtp_port = cls.get_smtp_config()
        return (
            f"platforms={names}; smtp={smtp_host}:{smtp_port}; data_file={cls.DATA_FILE}; "
            f"archive_terminal={cls.ARCHIVE_TERMINAL}"
        )
