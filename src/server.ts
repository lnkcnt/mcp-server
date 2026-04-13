import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

type HttpMethod = "GET" | "POST";

type ReportReason =
  | "phishing"
  | "malware"
  | "spam"
  | "redirectloop"
  | "unaccessible"
  | "adult"
  | "harassment"
  | "violence"
  | "illegal"
  | "other";

const DEFAULT_BASE_URL = process.env.LNKCNT_BASE_URL ?? "http://localhost:3000";
const PORT = Number(process.env.PORT ?? 3333);

let currentBaseUrl = normalizeBaseUrl(DEFAULT_BASE_URL);

const server = new McpServer(
  { name: "lnkcnt-mcp", version: "0.1.0" },
  {
    instructions:
      "Lnkcnt URL 단축/조회/삭제/차트/신고 API를 호출합니다. 사용 전 get_base_url 또는 set_base_url로 대상 API 서버를 확인하세요.",
  },
);

function normalizeBaseUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  return parsed.toString().replace(/\/$/, "");
}

function resolveBaseUrl(overrideBaseUrl?: string): string {
  if (!overrideBaseUrl) {
    return currentBaseUrl;
  }
  return normalizeBaseUrl(overrideBaseUrl);
}

async function callApi<TResponse>(params: {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  baseUrlOverride?: string;
}): Promise<
  | { ok: true; status: number; data: TResponse }
  | { ok: false; status: number; data: unknown }
> {
  const baseUrl = resolveBaseUrl(params.baseUrlOverride);
  const targetUrl = new URL(`${baseUrl}${params.path}`);

  if (params.query) {
    for (const [key, value] of Object.entries(params.query)) {
      if (value !== undefined) {
        targetUrl.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(targetUrl, {
    method: params.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  let parsed: unknown;
  const text = await response.text();
  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (response.ok) {
    return { ok: true, status: response.status, data: parsed as TResponse };
  }

  return { ok: false, status: response.status, data: parsed };
}

function successText(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorText(message: string, data?: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ message, data }, null, 2),
      },
    ],
  };
}

server.registerTool(
  "get_base_url",
  {
    description: "현재 Lnkcnt API Base URL을 조회합니다.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async () => {
    return successText({ baseUrl: currentBaseUrl });
  },
);

server.registerTool(
  "set_base_url",
  {
    description:
      "Lnkcnt API Base URL 기본값을 변경합니다. 예: http://localhost:3000 또는 https://lnkcnt.example.com",
    inputSchema: {
      baseUrl: z.string().url().describe("변경할 API Base URL"),
    },
    annotations: { idempotentHint: true },
  },
  async ({ baseUrl }) => {
    try {
      currentBaseUrl = normalizeBaseUrl(baseUrl);
      return successText({ baseUrl: currentBaseUrl, changed: true });
    } catch {
      return errorText("유효하지 않은 Base URL 형식입니다.", { baseUrl });
    }
  },
);

server.registerTool(
  "shorten_url",
  {
    description: "URL을 단축합니다.",
    inputSchema: {
      url: z.string().url().describe("단축할 원본 URL"),
      baseUrl: z
        .string()
        .url()
        .optional()
        .describe("이번 호출에만 적용할 API Base URL"),
    },
  },
  async ({ url, baseUrl }) => {
    const result = await callApi({
      method: "POST",
      path: "/api/url/shorten",
      body: { url },
      baseUrlOverride: baseUrl,
    });

    if (!result.ok) {
      return errorText("shorten_url 호출이 실패했습니다.", {
        status: result.status,
        response: result.data,
      });
    }

    return successText(result.data);
  },
);

server.registerTool(
  "get_manage_link",
  {
    description: "관리 토큰(id)으로 링크 상세 정보와 클릭 기록을 조회합니다.",
    inputSchema: {
      id: z
        .string()
        .min(32)
        .max(32)
        .regex(/^[a-z0-9_-]{32}$/)
        .describe("관리 페이지 토큰(32자)"),
      baseUrl: z
        .string()
        .url()
        .optional()
        .describe("이번 호출에만 적용할 API Base URL"),
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ id, baseUrl }) => {
    const result = await callApi({
      method: "GET",
      path: "/api/url/manage",
      query: { id },
      baseUrlOverride: baseUrl,
    });

    if (!result.ok) {
      return errorText("get_manage_link 호출이 실패했습니다.", {
        status: result.status,
        response: result.data,
      });
    }

    return successText(result.data);
  },
);

server.registerTool(
  "get_click_charts",
  {
    description:
      "기간(startYear/startMonth~endYear/endMonth)의 일별 클릭 합계를 조회합니다.",
    inputSchema: {
      id: z.string().describe("단축 링크 ID"),
      startYear: z.number().int().describe("시작 연도"),
      startMonth: z.number().int().min(0).max(11).describe("시작 월(0-11)"),
      endYear: z.number().int().optional().describe("종료 연도(선택)"),
      endMonth: z
        .number()
        .int()
        .min(0)
        .max(11)
        .optional()
        .describe("종료 월(선택, 0-11)"),
      baseUrl: z
        .string()
        .url()
        .optional()
        .describe("이번 호출에만 적용할 API Base URL"),
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ id, startYear, startMonth, endYear, endMonth, baseUrl }) => {
    const result = await callApi({
      method: "GET",
      path: "/api/charts",
      query: { id, startYear, startMonth, endYear, endMonth },
      baseUrlOverride: baseUrl,
    });

    if (!result.ok) {
      return errorText("get_click_charts 호출이 실패했습니다.", {
        status: result.status,
        response: result.data,
      });
    }

    return successText(result.data);
  },
);

server.registerTool(
  "submit_url_report",
  {
    description: "악성/부적절 링크를 신고합니다.",
    inputSchema: {
      id: z.string().describe("신고할 단축 링크 ID"),
      reason: z
        .enum([
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
        ] as [ReportReason, ...ReportReason[]])
        .describe("신고 사유"),
      message: z.string().min(1).max(300).describe("신고 상세 메시지(1~300자)"),
      baseUrl: z
        .string()
        .url()
        .optional()
        .describe("이번 호출에만 적용할 API Base URL"),
    },
  },
  async ({ id, reason, message, baseUrl }) => {
    const result = await callApi({
      method: "POST",
      path: "/api/report",
      body: { id, reason, message },
      baseUrlOverride: baseUrl,
    });

    if (!result.ok) {
      return errorText("submit_url_report 호출이 실패했습니다.", {
        status: result.status,
        response: result.data,
      });
    }

    return successText(result.data);
  },
);

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, name: "lnkcnt-mcp" });
});

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    void transport.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "MCP transport error",
        data: error instanceof Error ? error.message : "unknown error",
      },
      id: null,
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`lnkcnt-mcp listening on :${PORT}, baseUrl=${currentBaseUrl}`);
});
