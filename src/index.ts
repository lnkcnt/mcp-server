import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { z } from "zod";
import ky from "ky";

const args = process.argv.slice(2);

const server = new McpServer(
    {
        name: "lnkcnt-mcp-server",
        version: "1.0.0",
    },
    {
        instructions:
            "Use the tools to inspect the server status, echo text, and get the current time. The server is intentionally minimal and local-first.",
    },
);

server.registerTool(
    "health_check",
    {
        title: "Health Check",
        description:
            "Return a simple status payload for verifying the server is reachable.",
        inputSchema: z.object({}).strict(),
        outputSchema: z.object({
            status: z.literal("ok"),
            server: z.string(),
            timestamp: z.string(),
        }),
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    async () => {
        const output = {
            status: "ok" as const,
            server: "lnkcnt-mcp-server",
            timestamp: new Date().toISOString(),
        };

        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    },
);

server.registerTool(
    "shorten_url",
    {
        title: "Shorten URL",
        description: "Shorten a URL.",
        inputSchema: z.object({ url: z.httpUrl() }),
        outputSchema: z.object({
            message: z.enum([
                "URL generated successfully.",
                "This URL is not allowed",
                "URL is invalid",
                "Invalid JSON body",
            ]),
            success: z.boolean(),
            generatedId: z.optional(z.nanoid()),
            managePage: z.optional(z.string().length(32)),
            errors: z.optional(
                z.object({
                    errors: z.array(z.string()),
                    properties: z.optional(z.array(z.string())),
                }),
            ),
        }),
    },
    async ({ url }) => {
        const requestUrl = `${args[0]}/api/url/shorten`;
        console.log(`Sending POST request to '${requestUrl}'...`);
        const output = await ky.post(`${args[0]}/api/url/shorten`, {
            json: { url },
        });
        return {
            content: [{ type: "text", text: JSON.stringify(output.json()) }],
        };
    },
);

server.registerTool(
    "get_url_info",
    {
        title: "Get URL information",
        description: "Get URL information based on management ID.",
        inputSchema: z.object({ id: z.string().length(32) }),
        outputSchema: z.object({
            id: z.optional(z.nanoid()),
            redirect_url: z.optional(z.httpUrl()),
            click_count: z.optional(z.number().nonnegative()),
            clicks: z.optional(z.date()),
            error: z.optional(
                z.enum([
                    "Internal server error",
                    "Link not found",
                    "Link data not found",
                    "Bad Request: id required",
                ]),
            ),
        }),
    },
    async ({ id }) => {
        const requestUrl = `${args[0]}/api/url/manage?id=${id}`;
        console.log(`Sending GET request to '${requestUrl}'...`);
        const output = await ky.get(requestUrl);
        return {
            content: [{ type: "text", text: JSON.stringify(output.json()) }],
        };
    },
);

server.registerTool(
    "report_url",
    {
        title: "Report URL",
        description: "Submit report of URL.",
        inputSchema: z.object({
            id: z.nanoid(),
            reason: z.enum([
                "phishing",
                "malware",
                "spam",
                "redirectloop",
                "unaccessible",
                "adult",
                "harassment",
                "violence",
                "illegal",
                "other",
            ]),
            message: z.string().trim().min(1).max(300),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            reportId: z.optional(z.number().nonnegative()),
            error: z.optional(
                z.enum([
                    "Internal server error",
                    "Invalid values",
                    "Link not found",
                    "Missing required fields",
                ]),
            ),
        }),
    },
    async ({ id, reason, message }) => {
        const requestUrl = `${args[0]}/api/report`;
        console.log(`Sending POST request to '${requestUrl}'...`);
        const output = await ky.post(requestUrl, {
            json: { id, reason, message },
        });
        return {
            content: [{ type: "text", text: JSON.stringify(output.json()) }],
        };
    },
);

server.registerTool(
    "get_chart_data",
    {
        title: "Get chart data",
        description: "Get chart data (click counts) of URL.",
        inputSchema: z.object({
            id: z.nanoid(),
            startYear: z.number().positive(),
            startMonth: z.number().min(1).max(12),
            endYear: z.optional(z.number().positive()),
            endMonth: z.optional(z.number().min(1).max(12)),
        }),
        outputSchema: z.object({
            data: z.array(
                z.object({ date: z.iso.date(), sum: z.number().nonnegative() }),
            ),
        }),
    },
    async ({ id, startYear, startMonth, endYear, endMonth }) => {
        const requestUrl = `${args[0]}/api/charts`;
        console.log(`Sending POST request to '${requestUrl}'...`);
        const output = await ky.post(requestUrl, {
            json: { id, startYear, startMonth, endYear, endMonth },
        });
        return {
            content: [{ type: "text", text: JSON.stringify(output.json()) }],
        };
    },
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Failed to start MCP server: ${message}\n`);
    process.exit(1);
});
