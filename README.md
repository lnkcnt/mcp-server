# lnkcnt-mcp-server

lnkcnt를 LLM으로 이용하세요!

## 포함된 도구

- `shorten_url`: URL 단축
- `get_url_info`: 관리 ID로 정보 얻기
- `report_url`: URL 신고
- `get_url_stats`: URL 관리 ID로 통계 얻기

## 요구 사항

- pnpm

## 실행

1. 의존성 설치

    `pnpm install`

2. 빌드

    `pnpm build`

3. MCP 클라이언트(Codex, Claude Code, Antigravity 등)에 등록

예시:

```json
{
    "mcpServers": {
        "lnkcnt-mcp-server": {
            "command": "pnpm",
            "args": ["start", "lnkcnt-instance-url"],
            "cwd": "/your-project-path/lnkcnt-mcp"
        }
    }
}
```
