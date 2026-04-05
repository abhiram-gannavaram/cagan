# Contributing to BYOA Dev

Thank you for your interest in contributing to BYOA Dev!

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/byoadev/byoadev.git
cd byoadev
```

2. Install dependencies:
```bash
pnpm install
```

3. Build all packages:
```bash
pnpm -r build
```

4. Run tests:
```bash
pnpm -r test
```

## Project Structure

- `packages/core` - Shared engine used by CLI and VS Code extension
- `packages/cli` - Terminal CLI tool
- `packages/vscode-extension` - VS Code extension
- `packages/marketplace` - MCP server registry

## Making Changes

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and write tests

3. Ensure all tests pass:
```bash
pnpm -r test
```

4. Build to verify compilation:
```bash
pnpm -r build
```

5. Commit and push:
```bash
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
```

6. Open a Pull Request

## Code Style

- TypeScript is used throughout
- Run `pnpm lint` before committing
- Follow existing patterns in the codebase

## Testing

- Unit tests are in `src/__tests__/` directories
- Run tests with `pnpm test` in each package
- Tests use Vitest

## Questions?

- Open an issue for bugs or feature requests
- Join discussions on GitHub

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.