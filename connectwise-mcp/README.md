# ConnectWise PSA MCP server

A **read-only** [MCP](https://modelcontextprotocol.io) server that lets Claude (Claude Desktop or
Claude Code) answer questions about your ConnectWise PSA (Manage) data: tickets, companies,
contacts, time entries, agreements, projects, invoices, opportunities, and any other GET endpoint.

It only issues HTTP `GET` requests. It can't create, update, or delete anything in PSA.

## 1. Create API credentials in ConnectWise

1. **Make a restricted security role.** *System > Security Roles > New*, e.g. `API - Read Only`.
   Give it **Inquire** access (Level: All) only for the modules you want Claude to see
   (Service Desk, Companies, Time & Expense, Project, Finance, Sales…). Set Add/Edit/Delete to **None**.
   This is your real safety boundary: it applies even if the code changes later.
2. **Create an API Member.** *System > Members > API Members tab > +*. Assign the role above,
   plus a location, business unit, and default territory.
3. **Generate keys.** Open the API member and go to *API Keys > +*. Copy the public and private keys.
   You only see the private key once.
4. **Get a Client ID.** Register at <https://developer.connectwise.com/ClientID>. It's free and gives you a GUID.
5. **Find your API host.** For cloud tenants it's `api-na.myconnectwise.net`, `api-eu.myconnectwise.net`, or
   `api-au.myconnectwise.net`. Match it to your login region. For on-prem, use your server hostname.

## 2. Install

Requires Python 3.10+. With [uv](https://docs.astral.sh/uv/) (recommended):

```bash
git clone <this repo> && cd rando2/connectwise-mcp
uv sync
```

Or with pip: `python -m venv .venv && .venv/bin/pip install -e .`

Check the credentials before wiring up Claude:

```bash
CW_SITE=api-na.myconnectwise.net CW_COMPANY_ID=yourco CW_PUBLIC_KEY=... \
CW_PRIVATE_KEY=... CW_CLIENT_ID=... uv run connectwise-mcp --check
```

## 3. Connect Claude

### Claude Desktop

**Easiest:** copy `.env.example` to `.env` in this folder and fill it in. The server reads it
automatically, so the config below needs no `"env"` block. Values set in `"env"` override `.env`.

Edit `claude_desktop_config.json`. On macOS it's in `~/Library/Application Support/Claude/`. On Windows it's in `%APPDATA%\Claude\`.

```json
{
  "mcpServers": {
    "connectwise": {
      "command": "uv",
      "args": ["--directory", "/ABSOLUTE/PATH/TO/rando2/connectwise-mcp", "run", "connectwise-mcp"],
      "env": {
        "CW_SITE": "api-na.myconnectwise.net",
        "CW_COMPANY_ID": "yourco",
        "CW_PUBLIC_KEY": "xxxx",
        "CW_PRIVATE_KEY": "xxxx",
        "CW_CLIENT_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop. If `uv` isn't on Claude's PATH, use its full path (`which uv`).

### Claude Code

```bash
claude mcp add connectwise \
  -e CW_SITE=api-na.myconnectwise.net -e CW_COMPANY_ID=yourco \
  -e CW_PUBLIC_KEY=xxxx -e CW_PRIVATE_KEY=xxxx -e CW_CLIENT_ID=xxxx \
  -- uv --directory /ABSOLUTE/PATH/TO/rando2/connectwise-mcp run connectwise-mcp
```

## Tools

| Tool | Purpose |
|---|---|
| `find_tickets` | Search tickets by board, status, company, owner, resource, priority, summary text, and entered/closed dates |
| `get_ticket` | One ticket with notes, and optionally its time entries |
| `find_companies` | Search companies by name, identifier, status, or type |
| `find_contacts` | Search contacts by name, email, or company |
| `time_entries` | Time in a date range by member, company, or ticket, with hour totals |
| `cw_count` | Fast counts on any collection (`service/tickets/count` etc.) |
| `cw_query` | Any GET endpoint with full `conditions` / `childConditions` / `customFieldConditions` / `fields` / `orderBy` support |

Example questions:

- "How many open tickets are on the Help Desk board, broken down by status?"
- "Show me everything for ACME that's been waiting on client for more than a week."
- "How many hours did jsmith log last week, and on which companies?"
- "Which agreements expire in the next 60 days?"
- "Summarize ticket 123456 and its notes."

## Limitations

- **Pagination.** Each call returns one page, up to 1000 rows. Tools report `may_have_more`.
  For aggregate questions over large datasets, Claude must page through results or use `cw_count`.
  Expect it to be slow and token-heavy for things like "total hours across all of 2026".
  Native PSA reports or a BI export are better for heavy analytics.
- **Data goes to Claude.** Anything the API member can read can end up in the model context.
  Scope the security role accordingly. Leave out HR and finance modules if you don't need them.
- **Field names vary by PSA version and customization.** If a filter returns HTTP 400,
  Claude will see the error and can retry with corrected conditions.
- **Local only (stdio).** It isn't a hosted connector for claude.ai web or mobile. That would need
  an internet-facing deployment with OAuth in front of it. Don't expose it without auth.

## Development

```bash
uv sync --extra dev && uv run pytest
```

Tests use a mocked ConnectWise API. They have not been run against a live tenant.
