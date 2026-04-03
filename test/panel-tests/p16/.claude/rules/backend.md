When editing backend code:
- Handle all errors explicitly — never swallow exceptions silently
- Validate all external input at API boundaries
- Use dependency injection for testability
- Keep route handlers thin — delegate to service/business logic layers
- Log errors with sufficient context for debugging
- Never hardcode secrets or credentials
