# PR #8: private Vega MCP over OpenAI Secure MCP Tunnel

Run `npm install` in `apps/api`, then `npm run start:mcp-readonly` with `MCP_READ_ONLY_HOST=127.0.0.1`, `MCP_READ_ONLY_PORT=4113` and a protected local `MCP_READ_ONLY_TOKEN`.
The server requires bearer authentication, rejects unexpected Host/Origin values, validates bounded tool arguments, and exposes only read-only tools.
Search structured content is an object containing `items`, so Streamable HTTP clients can validate the response.
The supported protocol revisions are 2025-03-26, 2025-06-18 and 2025-11-25.

The Vega stock service uses the dedicated `BIONIC_VEGA_SQL_*` connection and verifies effective SELECT-only permissions before use.
It has no fallback to the regular ERP SQL connection. Credentials remain outside Git.
The count query brackets the SQL Server `rowCount` alias; product name, brand and category use the verified `MALINCINSI`, `KOD1` and `KOD4` fields.
Unknown price, currency, barcode and unit fields remain null; do not infer missing commercial values.

OpenAI Secure MCP Tunnel connects outbound to OpenAI and forwards only to `http://127.0.0.1:4113/mcp`.
Do not create a public tunnel or inbound firewall rule. Do not use an admin key for the running daemon.
The runtime principal needs organization-level Tunnels Read + Use; use a dedicated runtime key in `CONTROL_PLANE_API_KEY`.
The client can inject the local bearer through `MCP_EXTRA_HEADERS` and `MCP_DISCOVERY_EXTRA_HEADERS`, using an environment secret reference.
Disable unsafe raw HTTP logging and keep operator health/UI bound to loopback.

Validate `initialize`, `tools/list`, `get_stock_count`, `search_products`, `get_product`, and `erp_readonly_health` locally.
After `tunnel-client runtimes connect`, require `runtimes status` to show running, healthy and ready before claiming ChatGPT readiness.
In ChatGPT's new plugin form, select Connection → Tunnel and the existing Melisa ERP MCP tunnel once runtime readiness is proven.

References: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels and the installed official `tunnel-client help quickstart`.
Rollback stops only the owned PR #8 MCP process and restarts the preserved previous MCP runner. Regular ERP and the 4112 gateway remain unchanged.
