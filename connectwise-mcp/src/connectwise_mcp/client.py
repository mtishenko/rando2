"""Minimal read-only client for the ConnectWise PSA (Manage) REST API."""

from __future__ import annotations

import base64
import os
import re
from dataclasses import dataclass
from typing import Any

import httpx
from mcp.server.mcpserver.exceptions import ToolError

# Endpoint paths may only contain these characters. Blocks "..", query strings,
# absolute URLs, etc. so a model can't redirect the request elsewhere.
_ENDPOINT_RE = re.compile(r"^[A-Za-z0-9_\-/]+$")

MAX_PAGE_SIZE = 1000


# Subclassing ToolError makes the MCP SDK pass these messages through to Claude
# instead of masking them as a generic "Error executing tool".
class ConfigError(ToolError):
    pass


class ConnectWiseError(ToolError):
    pass


class InvalidInput(ToolError, ValueError):
    pass


@dataclass(frozen=True)
class Settings:
    site: str
    company_id: str
    public_key: str
    private_key: str
    client_id: str
    codebase: str = "v4_6_release/"
    api_version: str | None = None
    timeout: float = 30.0

    @classmethod
    def from_env(cls) -> "Settings":
        required = {
            "CW_SITE": "e.g. api-na.myconnectwise.net",
            "CW_COMPANY_ID": "the company ID you type on the PSA login screen",
            "CW_PUBLIC_KEY": "API member public key",
            "CW_PRIVATE_KEY": "API member private key",
            "CW_CLIENT_ID": "GUID from https://developer.connectwise.com/ClientID",
        }
        missing = [f"{k} ({hint})" for k, hint in required.items() if not os.environ.get(k)]
        if missing:
            raise ConfigError("Missing environment variables: " + "; ".join(missing))

        site = os.environ["CW_SITE"].strip()
        site = re.sub(r"^https?://", "", site).rstrip("/")
        codebase = os.environ.get("CW_CODEBASE", "v4_6_release/").strip().strip("/") + "/"
        return cls(
            site=site,
            company_id=os.environ["CW_COMPANY_ID"].strip(),
            public_key=os.environ["CW_PUBLIC_KEY"].strip(),
            private_key=os.environ["CW_PRIVATE_KEY"].strip(),
            client_id=os.environ["CW_CLIENT_ID"].strip(),
            codebase=codebase,
            api_version=os.environ.get("CW_API_VERSION") or None,
            timeout=float(os.environ.get("CW_TIMEOUT", "30")),
        )

    @property
    def base_url(self) -> str:
        return f"https://{self.site}/{self.codebase}apis/3.0/"

    def headers(self) -> dict[str, str]:
        token = base64.b64encode(
            f"{self.company_id}+{self.public_key}:{self.private_key}".encode()
        ).decode()
        accept = "application/vnd.connectwise.com+json"
        if self.api_version:
            accept += f"; version={self.api_version}"
        return {
            "Authorization": f"Basic {token}",
            "clientId": self.client_id,
            "Accept": accept,
        }


def normalize_endpoint(endpoint: str) -> str:
    ep = endpoint.strip().strip("/")
    if not ep or not _ENDPOINT_RE.match(ep) or ".." in ep:
        raise InvalidInput(
            f"Invalid endpoint {endpoint!r}. Use a relative API path such as "
            "'service/tickets' or 'company/companies/250'."
        )
    return ep


def strip_info(obj: Any) -> Any:
    """Drop ConnectWise '_info' metadata blocks (hrefs, audit stamps) to save tokens."""
    if isinstance(obj, dict):
        return {k: strip_info(v) for k, v in obj.items() if k != "_info"}
    if isinstance(obj, list):
        return [strip_info(v) for v in obj]
    return obj


def quote(value: str) -> str:
    """Quote a value for use inside a ConnectWise conditions string."""
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


class ConnectWiseClient:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self.settings = settings
        self._http = httpx.AsyncClient(
            base_url=settings.base_url,
            headers=settings.headers(),
            timeout=settings.timeout,
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def get(self, endpoint: str, params: dict[str, Any] | None = None) -> Any:
        ep = normalize_endpoint(endpoint)
        clean = {k: v for k, v in (params or {}).items() if v not in (None, "")}
        try:
            resp = await self._http.get(ep, params=clean)
        except httpx.HTTPError as e:
            raise ConnectWiseError(f"Network error calling ConnectWise: {e}") from e

        if resp.status_code >= 400:
            raise ConnectWiseError(_explain_error(resp, ep))
        if not resp.content:
            return None
        return strip_info(resp.json())


def _explain_error(resp: httpx.Response, ep: str) -> str:
    try:
        body = resp.json()
        detail = body.get("message") or body
        if isinstance(body, dict) and body.get("errors"):
            detail = f"{detail} {body['errors']}"
    except Exception:
        detail = resp.text[:500]
    hint = {
        400: "Check the conditions syntax and field names.",
        401: "Authentication failed: check CW_COMPANY_ID, public/private keys, and CW_SITE.",
        403: "The API member's security role does not allow this. Grant 'Inquire' access in "
        "System > Security Roles for the relevant module.",
        404: "Endpoint or record not found.",
        429: "Rate limited by ConnectWise; retry shortly.",
    }.get(resp.status_code, "")
    return f"ConnectWise returned HTTP {resp.status_code} for '{ep}': {detail} {hint}".strip()
