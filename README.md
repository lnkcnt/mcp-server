# lnkcnt-mcp

Lnkcnt URL Shortener API를 MCP 도구로 노출하는 TypeScript 기반 Streamable HTTP 서버입니다.

## 제공 도구

- `get_base_url`: 현재 기본 API Base URL 조회
- `set_base_url`: 기본 API Base URL 변경
- `shorten_url`: URL 단축 생성
- `get_manage_link`: 관리 토큰 기반 링크/클릭 조회
- `delete_short_url`: 관리 토큰 기반 링크 삭제
- `get_click_charts`: 기간별 일간 클릭 합계 조회
- `submit_url_report`: 링크 신고

모든 API 호출 도구는 `baseUrl`(optional)을 받아, 호출별로도 Base URL을 변경할 수 있습니다.

## 실행

```bash
pnpm install
cp .env.example .env
pnpm dev
```

기본값:
- MCP 엔드포인트: `http://localhost:3333/mcp`
- 헬스체크: `http://localhost:3333/health`
- 기본 API Base URL: `http://localhost:3000` (환경변수 `LNKCNT_BASE_URL`로 변경 가능)

## Claude Code 연결 예시

```bash
claude mcp add --transport http lnkcnt http://localhost:3333/mcp
```

연결 후, 먼저 `get_base_url` 또는 `set_base_url`을 호출해 대상 API 서버를 맞춘 다음 작업하세요.

## 구현 라이브러리

- `@modelcontextprotocol/sdk` (공식 MCP TypeScript SDK)
  - https://github.com/modelcontextprotocol/typescript-sdk
- `express`
  - https://github.com/expressjs/express
- `zod`
  - https://github.com/colinhacks/zod
