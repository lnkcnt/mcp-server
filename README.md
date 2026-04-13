# lnkcnt-mcp-server

이 프로젝트는 pnpm 기반의 최소 MCP 서버 템플릿입니다.

## 포함 기능

- `health_check`: 서버 가동 상태 확인
- `echo_text`: 입력 문자열을 그대로 반환
- `current_time`: 서버 시간 반환

## 실행

1. 의존성 설치

    `pnpm install`

2. 개발 실행

    `pnpm dev`

3. 빌드

    `pnpm build`

4. 실행 파일로 구동

    `pnpm start`

## 클라이언트 설정 예시

stdio 방식으로 실행되는 로컬 MCP 서버이므로, 클라이언트에는 다음처럼 등록하면 됩니다.

```json
{
    "mcpServers": {
        "lnkcnt-mcp-server": {
            "command": "pnpm",
            "args": ["dev"],
            "cwd": "/Users/pji2918/RemoteProjects/lnkcnt-mcp"
        }
    }
}
```
