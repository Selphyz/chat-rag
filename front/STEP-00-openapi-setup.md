# Step 0: OpenAPI TypeScript Type Generation Setup

**Estimated Time:** 1-2 hours
**Prerequisites:** Node.js 18+, npm/yarn, openapi.yaml from backend
**Status:** Foundation - Must complete before Step 1

---

## Overview

This step establishes the type-safe API layer using OpenAPI specification. All subsequent API interactions will be built on top of the automatically generated types, ensuring compile-time safety and IDE autocomplete.

### What You'll Build
- OpenAPI code generator configuration
- Automated type generation from openapi.yaml
- Type directory structure (`src/types/api/`)
- Build scripts for type regeneration
- CI/CD integration for type validation

---

## 1. Prerequisites & Installation

### 1.1 Install OpenAPI Code Generator

Choose one of these tools:

#### Option A: Using `openapi-typescript` (Recommended for simplicity)

```bash
npm install --save-dev openapi-typescript
```

**Pros:** Lightweight, simple configuration, excellent TypeScript support
**Cons:** Less feature-rich than orval

#### Option B: Using `orval` (Recommended for advanced features)

```bash
npm install --save-dev orval
```

**Pros:** Generates full API client, better for complex APIs
**Cons:** Larger bundle, more configuration needed

#### Option C: Using Both (Flexibility)

```bash
npm install --save-dev openapi-typescript orval
```

**Recommendation:** Start with `openapi-typescript` for types, add `orval` later if you need auto-generated client methods.

---

## 2. Project Structure Setup

### 2.1 Create Types Directory

```bash
mkdir -p src/types/api
touch src/types/api/index.ts
touch src/types/api/auth.ts
touch src/types/api/chat.ts
touch src/types/api/documents.ts
```

### 2.2 Directory Structure

```
src/
├── types/
│   ├── api/
│   │   ├── index.ts              # Re-exports all generated types
│   │   ├── auth.ts               # Auth-related types (auto-generated)
│   │   ├── chat.ts               # Chat-related types (auto-generated)
│   │   ├── documents.ts          # Document-related types (auto-generated)
│   │   └── .gitkeep              # Ensure directory exists
│   ├── index.ts                  # Custom app-level types
│   └── common.ts                 # Shared types
├── services/
│   └── api/
│       └── client.ts             # API client using generated types
├── hooks/
├── components/
├── pages/
└── ...
```

---

## 3. Configuration Setup

### 3.1 Create `openapi-generator.config.ts` (for openapi-typescript)

Create file: `config/openapi-generator.config.ts`

```typescript
import { generateApi } from 'openapi-typescript';
import path from 'path';

export const openApiConfig = {
  // Path to backend openapi.yaml
  input: path.resolve(__dirname, '../openapi.yaml'),

  // Output directory for generated types
  output: path.resolve(__dirname, '../src/types/api'),

  // TypeScript generation options
  exportType: 'named',  // Use named exports instead of default

  // Don't generate client code, just types
  clientOnly: false,

  // Prettier formatting options
  prettier: {
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 2,
  },
};
```

### 3.2 Create `orval.config.ts` (for orval - Alternative)

Create file: `orval.config.ts` at project root

```typescript
import { defineConfig } from 'orval';

export default defineConfig({
  chatRagApi: {
    input: {
      target: './openapi.yaml',
    },
    output: {
      target: './src/types/api/index.ts',
      client: 'react-query',  // Generate React Query hooks
      httpClient: 'fetch',
      prettier: true,
      mode: 'single',
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});
```

---

## 4. Setup Build Scripts

### 4.1 Update `package.json`

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "generate:types": "openapi-typescript ./openapi.yaml --output ./src/types/api/index.ts",
    "generate:types:watch": "openapi-typescript ./openapi.yaml --output ./src/types/api/index.ts --watch",
    "generate:types:orval": "orval",
    "prebuild": "npm run generate:types",
    "predev": "npm run generate:types",
    "dev": "next dev",
    "build": "next build",
    "type-check": "tsc --noEmit && npm run generate:types"
  }
}
```

### 4.2 TypeScript Build Configuration

Update `tsconfig.json` to ensure generated types are recognized:

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@types/*": ["src/types/*"],
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "src/types/**/*"],
  "exclude": ["node_modules", ".next"]
}
```

---

## 5. Initial Type Generation

### 5.1 Generate Types from openapi.yaml

```bash
# Using openapi-typescript
npm run generate:types

# Or using orval
npm run generate:types:orval
```

### 5.2 Expected Output Structure

After running type generation, you should see:

```
src/types/api/
├── index.ts          # Contains all generated types and interfaces
├── auth.ts          # Auth endpoint types (if using named exports)
├── chat.ts          # Chat endpoint types (if using named exports)
└── documents.ts     # Document endpoint types (if using named exports)
```

### 5.3 Verify Generation

```bash
# Check that types were generated
cat src/types/api/index.ts | head -20

# Verify TypeScript can read them
npm run type-check
```

---

## 6. Create Type Export Index

### 6.1 Create `src/types/api/index.ts` (Manual organization)

If using `openapi-typescript` with named exports, organize re-exports:

```typescript
// Re-export all API types from generated files
export * from './auth';
export * from './chat';
export * from './documents';

// Common types
export interface ApiResponse<T> {
  data: T;
  status: number;
  timestamp: string;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
}

// Utility types for API interactions
export type MutationPayload<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
```

### 6.2 Create `src/types/index.ts` (App-level types)

```typescript
// Re-export all API types
export * from './api';

// App-specific types
export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AppState {
  auth: AuthState;
}
```

---

## 7. CI/CD Integration

### 7.1 Add Pre-commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh

echo "Validating OpenAPI types..."
npm run generate:types

if [ $? -ne 0 ]; then
  echo "Type generation failed. Please check openapi.yaml"
  exit 1
fi

# Check if types file is properly formatted
npm run type-check
```

### 7.2 GitHub Actions Workflow (Optional)

Create `.github/workflows/type-check.yml`:

```yaml
name: Type Safety Check

on: [pull_request, push]

jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate API types
        run: npm run generate:types

      - name: TypeScript type check
        run: npm run type-check

      - name: Check if types are up-to-date
        run: |
          git diff --exit-code src/types/api/
          if [ $? -ne 0 ]; then
            echo "Generated types are out of sync with openapi.yaml"
            exit 1
          fi
```

---

## 8. Development Workflow

### 8.1 Development Mode with Watch

```bash
# Terminal 1: Start development server with auto-type-generation
npm run dev

# Terminal 2 (Optional): Watch for openapi.yaml changes
npm run generate:types:watch
```

### 8.2 Type Generation Best Practices

1. **Always regenerate after backend updates**
   ```bash
   npm run generate:types
   ```

2. **Commit generated types to version control**
   ```bash
   git add src/types/api/
   git commit -m "Update generated API types from openapi.yaml"
   ```

3. **Keep openapi.yaml synchronized**
   - Copy latest openapi.yaml from backend before generating
   - Version control the openapi.yaml file

---

## 9. Testing Type Generation

### 9.1 Create Test File `tests/types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import * as ApiTypes from '@types/api';

describe('Generated API Types', () => {
  it('should have all auth types', () => {
    expect(ApiTypes).toHaveProperty('LoginRequest');
    expect(ApiTypes).toHaveProperty('AuthResponse');
    expect(ApiTypes).toHaveProperty('User');
  });

  it('should have all chat types', () => {
    expect(ApiTypes).toHaveProperty('Chat');
    expect(ApiTypes).toHaveProperty('Message');
    expect(ApiTypes).toHaveProperty('CreateChatRequest');
  });

  it('should have all document types', () => {
    expect(ApiTypes).toHaveProperty('Document');
    expect(ApiTypes).toHaveProperty('DocumentUploadRequest');
  });
});
```

---

## 10. Validation Checklist

- [ ] OpenAPI code generator installed (openapi-typescript or orval)
- [ ] `src/types/api/` directory created
- [ ] Build scripts added to `package.json`
- [ ] `tsconfig.json` updated with path aliases
- [ ] Initial type generation successful (`npm run generate:types`)
- [ ] Generated types file has content and no errors
- [ ] `npm run type-check` passes
- [ ] Type exports in `src/types/api/index.ts` work correctly
- [ ] Import paths work: `import { User } from '@types/api'`
- [ ] Pre-commit hook installed (optional but recommended)
- [ ] CI/CD workflow added to repository (optional)

---

## 11. Troubleshooting

### Issue: "openapi.yaml not found"
**Solution:** Ensure openapi.yaml is in project root and path in config is correct
```bash
ls -la openapi.yaml
```

### Issue: Generated types are empty
**Solution:** Check openapi.yaml is valid YAML/JSON
```bash
npm install -g yaml-validator
yaml-validator openapi.yaml
```

### Issue: Type generation fails with "No paths found"
**Solution:** Verify openapi.yaml has proper structure with `/paths` section

### Issue: "Cannot find module '@types/api'"
**Solution:** Ensure `tsconfig.json` has proper path alias:
```json
{
  "compilerOptions": {
    "paths": {
      "@types/*": ["src/types/*"]
    }
  }
}
```

---

## 12. Next Steps

After completing this step:
1. ✅ Commit generated types to git
2. → Proceed to **STEP-01-project-setup.md**
3. → Build API client in STEP-02 using these types
4. → All API interactions will be type-safe

---

## References

- [OpenAPI TypeScript Generator](https://github.com/drwpow/openapi-typescript)
- [Orval Documentation](https://orval.dev/)
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [TypeScript Path Aliases](https://www.typescriptlang.org/tsconfig#paths)
