import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import ky from "ky";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { parseArgs } from "node:util";

const args = parseArgs({
    allowPositionals: true,
});
const urlValidator = z.httpUrl();
const url = urlValidator.safeParse(args.positionals[0]);

/**
 * 새로운 MCP 서버 인스턴스를 생성합니다.
 */
function createServer(): McpServer {
    const instanceUrl = url.data!.endsWith("/")
        ? url.data?.slice(0, -1)
        : url.data;
    const server = new McpServer(
        {
            name: "lnkcnt-mcp",
            version: "1.0.0",
        },
        {
            instructions:
                "해당 MCP 서버를 사용해 lnkcnt 서비스와 상호작용할 수 있습니다.\n" +
                "사용자가 URL의 단축을 요청하거나, 'lnkcnt'를 직접 언급한다면 해당 MCP 서버를 사용하세요.",
        }
    );

    server.registerTool(
        "shorten_url",
        {
            title: "Shorten URL",
            description:
                "Shorten a URL and returns shorten ID & Management page ID.\n" +
                `Shortened URL is ${instanceUrl}/{id}.\n` +
                `Management Page is ${instanceUrl}/manage/{managePage}.`,
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
                    })
                ),
            }),
        },
        async ({ url }) => {
            const requestUrl = `${args.positionals[0]}/api/url/shorten`;
            console.error(`Sending POST request to '${requestUrl}'...`);
            const output = await ky.post(
                `${args.positionals[0]}/api/url/shorten`,
                {
                    json: { url },
                }
            );
            const data = (await output.json()) as Record<string, unknown>;
            return {
                content: [{ type: "text", text: JSON.stringify(data) }],
                structuredContent: data,
            };
        }
    );

    server.registerTool(
        "get_url_info",
        {
            title: "Get URL information",
            description:
                "Get URL information based on management ID.\n" +
                `Shortened URL is ${instanceUrl}/{id}.`,
            inputSchema: z.object({ id: z.string().length(32) }),
            outputSchema: z.object({
                id: z.optional(z.nanoid()),
                redirect_url: z.optional(z.httpUrl()),
                click_count: z.optional(z.number().nonnegative()),
                clicks: z.optional(z.array(z.iso.datetime())),
                error: z.optional(
                    z.enum([
                        "Internal server error",
                        "Link not found",
                        "Link data not found",
                        "Bad Request: id required",
                    ])
                ),
            }),
        },
        async ({ id }) => {
            const requestUrl = `${args.positionals[0]}/api/url/manage`;
            console.error(`Sending GET request to '${requestUrl}'...`);
            const output = await ky.get(requestUrl, { searchParams: { id } });
            const data = (await output.json()) as Record<string, unknown>;
            return {
                content: [{ type: "text", text: JSON.stringify(data) }],
                structuredContent: data,
            };
        }
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
                    ])
                ),
            }),
        },
        async ({ id, reason, message }) => {
            const requestUrl = `${args.positionals[0]}/api/report`;
            console.error(`Sending POST request to '${requestUrl}'...`);
            const output = await ky.post(requestUrl, {
                json: { id, reason, message },
            });
            const data = (await output.json()) as Record<string, unknown>;
            return {
                content: [{ type: "text", text: JSON.stringify(data) }],
                structuredContent: data,
            };
        }
    );

    server.registerTool(
        "get_url_stats",
        {
            title: "Get URL stats",
            description:
                "Gets stat (click counts) of shortened URL. ID of URL is required.",
            inputSchema: z.object({
                id: z.nanoid(),
                startYear: z.number().positive(),
                startMonth: z.number().min(1).max(12),
                endYear: z.optional(z.number().positive()),
                endMonth: z.optional(z.number().min(1).max(12)),
            }),
            outputSchema: z.object({
                data: z.array(
                    z.object({
                        date: z.iso.date(),
                        sum: z.number().nonnegative(),
                    })
                ),
            }),
        },
        async ({ id, startYear, startMonth, endYear, endMonth }) => {
            const requestUrl = `${args.positionals[0]}/api/charts`;
            console.error(`Sending GET request to '${requestUrl}'...`);
            const output = await ky.get(requestUrl, {
                searchParams: { id, startYear, startMonth, endYear, endMonth },
            });
            const data = (await output.json()) as Record<string, unknown>;
            return {
                content: [{ type: "text", text: JSON.stringify(data) }],
                structuredContent: data,
            };
        }
    );

    return server;
}

async function main() {
    if (!args.positionals[0]) {
        console.error("ERROR: lnkcnt 인스턴스 URL이 제공되지 않았습니다.");
        process.exit(2);
    } else if (!url.success) {
        console.error("ERROR: lnkcnt 인스턴스 URL이 올바르지 않습니다.");
        process.exit(2);
    }

    process.on("SIGINT", () => {
        console.error("Exitting...");
        process.exit(0);
    });
    serveStdio(createServer);
    console.error("lnkcnt MCP server is running. Press CTRL+C to stop.");
}

void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start MCP server: ${message}\n`);
    process.exit(1);
});
