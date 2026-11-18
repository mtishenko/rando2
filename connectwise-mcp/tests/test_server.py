import base64
import json

import httpx
import pytest
from mcp import Client

from connectwise_mcp import server
from connectwise_mcp.client import ConnectWiseClient, Settings, normalize_endpoint, quote

SETTINGS = Settings(
    site="api-na.myconnectwise.net",
    company_id="acme",
    public_key="pub",
    private_key="priv",
    client_id="11111111-2222-3333-4444-555555555555",
)


@pytest.fixture
def recorded():
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        path = request.url.path
        if path.endswith("/count"):
            return httpx.Response(200, json={"count": 42})
        if path.endswith("/service/tickets/999"):
            return httpx.Response(404, json={"code": "NotFound", "message": "Ticket not found"})
        if path.endswith("/service/tickets/7"):
            return httpx.Response(200, json={"id": 7, "summary": "Printer", "_info": {"x": 1}})
        if path.endswith("/allNotes"):
            return httpx.Response(200, json=[{"id": 1, "text": "hi"}])
        if path.endswith("/time/entries"):
            return httpx.Response(200, json=[{"actualHours": 1.5}, {"actualHours": 2.25}])
        return httpx.Response(200, json=[{"id": 1, "_info": {"href": "x"}}])

    server._client = ConnectWiseClient(SETTINGS, transport=httpx.MockTransport(handler))
    yield calls
    server._client = None


def test_headers_and_base_url():
    h = SETTINGS.headers()
    assert base64.b64decode(h["Authorization"].split()[1]).decode() == "acme+pub:priv"
    assert h["clientId"] == SETTINGS.client_id
    assert SETTINGS.base_url == "https://api-na.myconnectwise.net/v4_6_release/apis/3.0/"


@pytest.mark.parametrize("bad", ["../secret", "http://evil.com/x", "service/tickets?x=1", ""])
def test_endpoint_validation(bad):
    with pytest.raises(ValueError):
        normalize_endpoint(bad)


def test_quote_escapes():
    assert quote('O"Brien') == '"O\\"Brien"'


async def call(name, args):
    async with Client(server.mcp) as c:
        res = await c.call_tool(name, args)
    text = res.content[0].text
    return res, text


async def test_tools_listed():
    async with Client(server.mcp) as c:
        names = {t.name for t in (await c.list_tools()).tools}
    assert {"cw_query", "cw_count", "find_tickets", "get_ticket",
            "find_companies", "find_contacts", "time_entries"} <= names


async def test_find_tickets_builds_conditions(recorded):
    res, text = await call("find_tickets", {
        "board": "Help Desk", "company": "ACME", "entered_after": "2026-01-01",
    })
    assert not res.is_error, text
    req = recorded[-1]
    assert req.method == "GET"
    assert req.url.path == "/v4_6_release/apis/3.0/service/tickets"
    cond = req.url.params["conditions"]
    assert 'closedFlag=false' in cond
    assert 'board/name="Help Desk"' in cond
    assert 'company/identifier="ACME"' in cond
    assert "dateEntered >= [2026-01-01T00:00:00Z]" in cond
    assert "_info" not in text


async def test_count(recorded):
    res, text = await call("cw_count", {"endpoint": "service/tickets", "conditions": "closedFlag=false"})
    assert json.loads(text)["count"] == 42
    assert recorded[-1].url.path.endswith("/service/tickets/count")


async def test_get_ticket_and_404(recorded):
    res, text = await call("get_ticket", {"ticket_id": 7})
    data = json.loads(text)
    assert data["ticket"]["summary"] == "Printer" and data["notes"][0]["text"] == "hi"
    res, text = await call("get_ticket", {"ticket_id": 999})
    assert res.is_error and "404" in text


async def test_time_entries_total(recorded):
    res, text = await call("time_entries", {"date_from": "2026-11-01", "date_to": "2026-11-07"})
    assert json.loads(text)["total_actual_hours_this_page"] == 3.75
    assert "timeStart <= [2026-11-07T23:59:59Z]" in recorded[-1].url.params["conditions"]


async def test_bad_date_rejected(recorded):
    res, text = await call("time_entries", {"date_from": "last week", "date_to": "2026-11-07"})
    assert res.is_error and "Invalid date" in text


async def test_company_type_uses_child_conditions(recorded):
    await call("find_companies", {"company_type": "Client"})
    assert recorded[-1].url.params["childConditions"] == 'types/name="Client"'


async def test_only_get_requests(recorded):
    await call("cw_query", {"endpoint": "company/companies"})
    assert all(r.method == "GET" for r in recorded)


def test_load_dotenv(tmp_path, monkeypatch):
    from connectwise_mcp.client import load_dotenv
    f = tmp_path / ".env"
    f.write_text('# c\nCW_A="quoted"\nexport CW_B=plain\nCW_C=fromfile\n')
    monkeypatch.delenv("CW_A", raising=False)
    monkeypatch.delenv("CW_B", raising=False)
    monkeypatch.setenv("CW_C", "real")
    load_dotenv(f)
    import os
    assert os.environ["CW_A"] == "quoted" and os.environ["CW_B"] == "plain"
    assert os.environ["CW_C"] == "real"
