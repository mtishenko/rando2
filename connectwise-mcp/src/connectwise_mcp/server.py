"""MCP server exposing read-only ConnectWise PSA queries to Claude."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.types import ToolAnnotations

from .client import MAX_PAGE_SIZE, ConnectWiseClient, InvalidInput, Settings, quote

INSTRUCTIONS = """\
Read-only access to the user's ConnectWise PSA (Manage) instance.

Prefer the specific tools (find_tickets, get_ticket, find_companies, find_contacts,
time_entries). For anything else use cw_query / cw_count against any GET endpoint.

Useful endpoints: service/tickets, service/tickets/{id}/notes, service/boards,
service/boards/{id}/statuses, company/companies, company/contacts, company/configurations,
time/entries, project/projects, project/tickets, finance/agreements,
finance/agreements/{id}/additions, finance/invoices, sales/opportunities,
procurement/products, schedule/entries, system/members.

Conditions syntax (ConnectWise): field/subfield operator value, joined with and/or.
  Strings in double quotes: status/name="New" and company/identifier="ACME"
  Dates in brackets:        dateEntered >= [2026-01-01T00:00:00Z]
  Booleans/numbers bare:    closedFlag=false and priority/id=3
  Operators: = != < <= > >= contains like (with %) in (e.g. id in (1,2,3)) not
Use cw_count for "how many" questions instead of paging through results.
Results are paginated (page_size max 1000); say so if you only looked at one page.
"""

mcp = MCPServer(name="connectwise-psa", instructions=INSTRUCTIONS, version="0.1.0")

READ_ONLY = ToolAnnotations(read_only_hint=True, destructive_hint=False, open_world_hint=True)

_client: ConnectWiseClient | None = None


def client() -> ConnectWiseClient:
    global _client
    if _client is None:
        _client = ConnectWiseClient(Settings.from_env())
    return _client


def _page_size(n: int) -> int:
    return max(1, min(int(n), MAX_PAGE_SIZE))


def _cw_date(value: str, end_of_day: bool = False) -> str:
    """Accept YYYY-MM-DD or ISO-8601 and return a ConnectWise [date] literal."""
    v = value.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        v += "T23:59:59Z" if end_of_day else "T00:00:00Z"
    try:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError as e:
        raise InvalidInput(f"Invalid date {value!r}; use YYYY-MM-DD or ISO-8601.") from e
    return f"[{v}]"


def _and(parts: list[str]) -> str | None:
    parts = [p for p in parts if p]
    return " and ".join(parts) if parts else None


async def _list(endpoint: str, conditions: str | None, order_by: str | None,
                page: int, page_size: int, fields: str | None = None) -> dict[str, Any]:
    ps = _page_size(page_size)
    rows = await client().get(endpoint, {
        "conditions": conditions,
        "orderBy": order_by,
        "fields": fields,
        "page": max(1, page),
        "pageSize": ps,
    })
    rows = rows or []
    return {
        "endpoint": endpoint,
        "conditions": conditions,
        "page": max(1, page),
        "returned": len(rows),
        "may_have_more": len(rows) == ps,
        "results": rows,
    }


# --------------------------------------------------------------------------- generic


@mcp.tool(annotations=READ_ONLY)
async def cw_query(
    endpoint: str,
    conditions: str | None = None,
    child_conditions: str | None = None,
    custom_field_conditions: str | None = None,
    order_by: str | None = None,
    fields: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> Any:
    """Run a GET against any ConnectWise PSA REST endpoint (read-only).

    endpoint: path relative to /apis/3.0/, e.g. "service/tickets", "company/companies/250",
        "service/tickets/12345/notes", "finance/agreements".
    conditions: ConnectWise conditions string, e.g. 'closedFlag=false and board/name="Help Desk"'.
    child_conditions: conditions on child collections, e.g. 'communicationItems/value like "%@acme.com"'.
    custom_field_conditions: e.g. 'caption="Region" and value="East"'.
    order_by: e.g. "dateEntered desc".
    fields: comma-separated fields to return (strongly recommended for large result sets),
        e.g. "id,summary,status/name,company/name".
    page / page_size: pagination; page_size max 1000.
    """
    data = await client().get(endpoint, {
        "conditions": conditions,
        "childConditions": child_conditions,
        "customFieldConditions": custom_field_conditions,
        "orderBy": order_by,
        "fields": fields,
        "page": max(1, page),
        "pageSize": _page_size(page_size),
    })
    if isinstance(data, list):
        return {
            "returned": len(data),
            "may_have_more": len(data) == _page_size(page_size),
            "results": data,
        }
    return data


@mcp.tool(annotations=READ_ONLY)
async def cw_count(
    endpoint: str,
    conditions: str | None = None,
    child_conditions: str | None = None,
    custom_field_conditions: str | None = None,
) -> dict[str, Any]:
    """Count records on a collection endpoint matching conditions (uses ConnectWise's /count).

    endpoint: collection path, e.g. "service/tickets" or "company/companies" (do not add /count).
    """
    ep = endpoint.strip().strip("/")
    if not ep.endswith("/count"):
        ep += "/count"
    data = await client().get(ep, {
        "conditions": conditions,
        "childConditions": child_conditions,
        "customFieldConditions": custom_field_conditions,
    })
    return {"endpoint": endpoint, "conditions": conditions, "count": (data or {}).get("count")}


# --------------------------------------------------------------------------- tickets

TICKET_FIELDS = (
    "id,summary,board/name,status/name,priority/name,company/identifier,company/name,"
    "contact/name,owner/identifier,resources,dateEntered,lastUpdated,closedDate,closedFlag,"
    "severity,impact,type/name,subType/name,item/name,actualHours,budgetHours,"
    "requiredDate,source/name,agreement/name"
)


@mcp.tool(annotations=READ_ONLY)
async def find_tickets(
    open_only: bool = True,
    board: str | None = None,
    status: str | None = None,
    company: str | None = None,
    summary_contains: str | None = None,
    owner: str | None = None,
    resource: str | None = None,
    priority: str | None = None,
    entered_after: str | None = None,
    entered_before: str | None = None,
    closed_after: str | None = None,
    closed_before: str | None = None,
    extra_conditions: str | None = None,
    order_by: str = "dateEntered desc",
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    """Search service tickets.

    board / status / priority: exact names, e.g. board="Help Desk", status="Waiting on Client".
    company: company identifier (short code) or full name; partial names match.
    owner / resource: member identifier (login), e.g. "jsmith".
    *_after / *_before: YYYY-MM-DD or ISO-8601 (UTC).
    extra_conditions: any additional raw ConnectWise conditions, ANDed in.
    Set open_only=False to include closed tickets (required for closed_* filters to be useful).
    """
    conds: list[str] = []
    if open_only:
        conds.append("closedFlag=false")
    if board:
        conds.append(f"board/name={quote(board)}")
    if status:
        conds.append(f"status/name={quote(status)}")
    if priority:
        conds.append(f"priority/name={quote(priority)}")
    if company:
        conds.append(
            f"(company/identifier={quote(company)} or company/name like {quote('%' + company + '%')})"
        )
    if summary_contains:
        conds.append(f"summary like {quote('%' + summary_contains + '%')}")
    if owner:
        conds.append(f"owner/identifier={quote(owner)}")
    if resource:
        conds.append(f"resources like {quote('%' + resource + '%')}")
    if entered_after:
        conds.append(f"dateEntered >= {_cw_date(entered_after)}")
    if entered_before:
        conds.append(f"dateEntered <= {_cw_date(entered_before, end_of_day=True)}")
    if closed_after:
        conds.append(f"closedDate >= {_cw_date(closed_after)}")
    if closed_before:
        conds.append(f"closedDate <= {_cw_date(closed_before, end_of_day=True)}")
    if extra_conditions:
        conds.append(f"({extra_conditions})")
    return await _list("service/tickets", _and(conds), order_by, page, page_size, TICKET_FIELDS)


@mcp.tool(annotations=READ_ONLY)
async def get_ticket(
    ticket_id: int,
    include_notes: bool = True,
    include_time_entries: bool = False,
    max_notes: int = 50,
) -> dict[str, Any]:
    """Get one service ticket with its full details, and optionally its notes and time entries."""
    c = client()
    result: dict[str, Any] = {"ticket": await c.get(f"service/tickets/{int(ticket_id)}")}
    if include_notes:
        result["notes"] = await c.get(
            f"service/tickets/{int(ticket_id)}/allNotes",
            {"pageSize": _page_size(max_notes)},
        )
    if include_time_entries:
        result["time_entries"] = await c.get("time/entries", {
            "conditions": f'chargeToType="ServiceTicket" and chargeToId={int(ticket_id)}',
            "orderBy": "timeStart desc",
            "pageSize": 200,
            "fields": "id,member/identifier,timeStart,timeEnd,actualHours,billableOption,notes,workType/name",
        })
    return result


# --------------------------------------------------------------------------- companies/contacts


@mcp.tool(annotations=READ_ONLY)
async def find_companies(
    name_contains: str | None = None,
    identifier: str | None = None,
    status: str | None = None,
    company_type: str | None = None,
    include_deleted: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    """Search companies (clients, prospects, vendors).

    status: e.g. "Active". company_type: type name, e.g. "Client", "Prospect".
    """
    conds: list[str] = []
    if not include_deleted:
        conds.append("deletedFlag=false")
    if name_contains:
        conds.append(f"name like {quote('%' + name_contains + '%')}")
    if identifier:
        conds.append(f"identifier={quote(identifier)}")
    if status:
        conds.append(f"status/name={quote(status)}")
    ps = _page_size(page_size)
    rows = await client().get("company/companies", {
        "conditions": _and(conds),
        # types is a collection, so it must be filtered via childConditions
        "childConditions": f"types/name={quote(company_type)}" if company_type else None,
        "orderBy": "name asc",
        "page": max(1, page),
        "pageSize": ps,
        "fields": "id,identifier,name,status/name,types,phoneNumber,website,city,state,"
                  "territory/name,market/name,accountNumber,dateAcquired,defaultContact/name",
    }) or []
    return {"returned": len(rows), "may_have_more": len(rows) == ps, "results": rows}


@mcp.tool(annotations=READ_ONLY)
async def find_contacts(
    name_contains: str | None = None,
    email: str | None = None,
    company: str | None = None,
    include_inactive: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    """Search contacts by name, email address, and/or company identifier or name."""
    conds: list[str] = []
    child: str | None = None
    if not include_inactive:
        conds.append("inactiveFlag=false")
    if name_contains:
        q = quote("%" + name_contains + "%")
        conds.append(f"(firstName like {q} or lastName like {q})")
    if company:
        conds.append(
            f"(company/identifier={quote(company)} or company/name like {quote('%' + company + '%')})"
        )
    if email:
        child = f"communicationItems/value like {quote('%' + email + '%')}"
    ps = _page_size(page_size)
    rows = await client().get("company/contacts", {
        "conditions": _and(conds),
        "childConditions": child,
        "orderBy": "lastName asc",
        "page": max(1, page),
        "pageSize": ps,
        "fields": "id,firstName,lastName,title,company/identifier,company/name,"
                  "communicationItems,defaultPhoneNbr,inactiveFlag",
    }) or []
    return {"returned": len(rows), "may_have_more": len(rows) == ps, "results": rows}


# --------------------------------------------------------------------------- time


@mcp.tool(annotations=READ_ONLY)
async def time_entries(
    date_from: str,
    date_to: str,
    member: str | None = None,
    company: str | None = None,
    ticket_id: int | None = None,
    billable_only: bool = False,
    page: int = 1,
    page_size: int = 500,
) -> dict[str, Any]:
    """List time entries in a date range, with total hours for the returned page.

    date_from / date_to: YYYY-MM-DD (inclusive). member: member identifier.
    company: company identifier. If may_have_more is true, totals cover only this page.
    """
    conds = [
        f"timeStart >= {_cw_date(date_from)}",
        f"timeStart <= {_cw_date(date_to, end_of_day=True)}",
    ]
    if member:
        conds.append(f"member/identifier={quote(member)}")
    if company:
        conds.append(f"company/identifier={quote(company)}")
    if ticket_id is not None:
        conds.append(f"chargeToId={int(ticket_id)}")
    if billable_only:
        conds.append('billableOption="Billable"')
    out = await _list(
        "time/entries", _and(conds), "timeStart asc", page, page_size,
        "id,member/identifier,company/identifier,chargeToType,chargeToId,timeStart,timeEnd,"
        "actualHours,hoursBilled,billableOption,workType/name,notes",
    )
    out["total_actual_hours_this_page"] = round(
        sum(float(r.get("actualHours") or 0) for r in out["results"]), 2
    )
    return out


def main() -> None:
    import argparse

    p = argparse.ArgumentParser(description="ConnectWise PSA MCP server")
    p.add_argument("--check", action="store_true",
                   help="Verify credentials by calling system/info, then exit")
    args = p.parse_args()

    if args.check:
        import asyncio

        async def _check() -> None:
            c = client()
            try:
                info = await c.get("system/info")
                print(f"OK: connected to {c.settings.base_url}")
                print(f"Version: {(info or {}).get('version')}")
            finally:
                await c.aclose()

        asyncio.run(_check())
        return

    mcp.run("stdio")


if __name__ == "__main__":
    main()
