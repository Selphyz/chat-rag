# Step 0: OpenAPI TypeScript Type Generation Setup

**Estimated Time:** 15-30 minutes
**Prerequisites:** Node.js 18+, npm, openapi.yaml in project root
**Status:** Foundation - Must complete before Step 1

---

## 1. Install openapi-typescript

```bash
npm install --save-dev openapi-typescript
```

---

## 2. Create Type Directory

```bash
mkdir -p src/types/api
```

---

## 3. Add Build Script to package.json

```json
{
  "scripts": {
    "generate:types": "openapi-typescript ./openapi.yaml --output ./src/types/api/index.ts"
  }
}
```

---

## 4. Generate Types

```bash
npm run generate:types
```

This generates `src/types/api/index.ts` with all types from openapi.yaml.

---

## 5. Update tsconfig.json

Ensure path aliases are configured:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@types/*": ["src/types/*"],
      "@/*": ["src/*"]
    }
  }
}
```

---

## 6. Verify Generation

```bash
# Check types were generated
ls -la src/types/api/index.ts

# Type check
npx tsc --noEmit
```

---

## Validation Checklist

- [ ] `openapi-typescript` installed
- [ ] `src/types/api/` directory created
- [ ] `generate:types` script added to package.json
- [ ] Type generation successful
- [ ] `src/types/api/index.ts` has content
- [ ] tsconfig.json has path aliases
- [ ] Type checking passes

---

## Next Steps

Proceed to **STEP-01-project-setup.md**
