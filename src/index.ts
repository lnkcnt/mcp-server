import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { z } from "zod";
import ky from "ky";

const args = process.argv.slice(2);

const server = new McpServer(
    {
        name: "lnkcnt-mcp",
        version: "1.0.0",
    },
    {
        instructions:
            "You can use this MCP server to communicate with lnkcnt (link shortener + click counter).",
    },
);

server.registerTool(
    "shorten_url",
    {
        title: "Shorten URL",
        description:
            "Shorten a URL and returns shortened url & management page id.",
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
        console.error(`Sending POST request to '${requestUrl}'...`);
        const output = await ky.post(`${args[0]}/api/url/shorten`, {
            json: { url },
        });
        const data = (await output.json()) as Record<string, unknown>;
        return {
            content: [{ type: "text", text: JSON.stringify(data) }],
            structuredContent: data,
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
            clicks: z.optional(z.iso.date()),
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
        const requestUrl = `${args[0]}/api/url/manage`;
        console.error(`Sending GET request to '${requestUrl}'...`);
        const output = await ky.get(requestUrl, { searchParams: { id } });
        const data = (await output.json()) as Record<string, unknown>;
        return {
            content: [{ type: "text", text: JSON.stringify(data) }],
            structuredContent: data,
        };
    },
);

server.registerTool(
    "report_url",
    {
        title: "Report URL",
        description: "Submit report of URL. ID of URL is required.",
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
        console.error(`Sending POST request to '${requestUrl}'...`);
        const output = await ky.post(requestUrl, {
            json: { id, reason, message },
        });
        const data = (await output.json()) as Record<string, unknown>;
        return {
            content: [{ type: "text", text: JSON.stringify(data) }],
            structuredContent: data,
        };
    },
);

server.registerTool(
    "get_chart_data",
    {
        title: "Get chart data",
        description:
            "Get chart data (click counts) of URL. ID of URL is required.",
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
        console.error(`Sending GET request to '${requestUrl}'...`);
        const output = await ky.get(requestUrl, {
            searchParams: { id, startYear, startMonth, endYear, endMonth },
        });
        const data = (await output.json()) as Record<string, unknown>;
        return {
            content: [{ type: "text", text: JSON.stringify(data) }],
            structuredContent: data,
        };
    },
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("lnkcnt MCP server is running");
}

void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start MCP server: ${message}\n`);
    process.exit(1);
});
