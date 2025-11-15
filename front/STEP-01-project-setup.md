# Step 1: Next.js Project Setup & Configuration

**Estimated Time:** 2-3 hours
**Prerequisites:** Node.js 18+, npm/yarn, STEP-00 completed
**Status:** Foundation - Critical for all subsequent steps

---

## Overview

This step establishes the complete Next.js 16 + React 19 + TypeScript development environment with all necessary dependencies, folder structure, and configuration.

### What You'll Build
- Next.js 16 project with React 19
- TypeScript strict mode configuration
- All required dependencies installed
- Project folder structure
- ESLint and Prettier setup
- Environment variables configuration
- Development and build tooling

---

## 1. Create Next.js Project

### 1.1 Initialize Next.js with Create-Next-App

```bash
# Using npm create (recommended)
npm create next-app@latest chat-rag-frontend -- \
  --typescript \
  --tailwind \
  --eslint \
  --src-dir \
  --app \
  --import-alias '@/*'

# Or using npx
npx create-next-app@latest chat-rag-frontend
```

**When prompted, select:**
- ✅ TypeScript
- ✅ ESLint
- ✅ Tailwind CSS (optional, we'll use Styled Components)
- ✅ `src/` directory
- ✅ App Router
- ✅ Import alias: `@/*`

### 1.2 Navigate to Project

```bash
cd chat-rag-frontend
```

---

## 2. Install Dependencies

### 2.1 Core Framework Dependencies

```bash
npm install next@16.0.3 react@19.2.0 react-dom@19.2.0 typescript@5.9.3
```

### 2.2 Form Management & Validation

```bash
npm install react-hook-form@^7.66.0 zod@^3.22.0 @hookform/resolvers@^3.3.0
```

### 2.3 State Management

```bash
npm install @tanstack/react-query@^4.42.0 @tanstack/react-query-devtools@^4.42.0
```

### 2.4 Styling

```bash
npm install styled-components@^5.3.11 @types/styled-components@^5.1.35
```

### 2.5 HTTP & API

```bash
npm install axios@^1.6.0
# Alternative if using only fetch API (no additional install needed)
```

### 2.6 Development Tools

```bash
npm install --save-dev \
  eslint@9.39.1 \
  eslint-config-next \
  prettier@^3.1.0 \
  @types/node@24.10.1 \
  @types/react@19.2.4 \
  @types/react-dom@19.2.3
```

### 2.7 Optional but Recommended

```bash
npm install --save-dev \
  @typescript-eslint/eslint-plugin@^6.0.0 \
  @typescript-eslint/parser@^6.0.0
```

### 2.8 Verification

```bash
npm list react next typescript
```

Expected output:
```
├── next@16.0.3
├── react@19.2.0
└── typescript@5.9.3
```

---

## 3. TypeScript Configuration

### 3.1 Update `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"],
      "@services/*": ["src/services/*"],
      "@types/*": ["src/types/*"],
      "@utils/*": ["src/utils/*"],
      "@context/*": ["src/context/*"],
      "@constants/*": ["src/constants/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.js"],
  "exclude": ["node_modules", ".next"],
  "next": {
    "cacheDir": "./.next"
  }
}
```

---

## 4. Environment Variables Setup

### 4.1 Create `.env.example`

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=Chat RAG

# Backend Service URLs
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
NEXT_PUBLIC_QDRANT_URL=http://localhost:6333

# Feature Flags
NEXT_PUBLIC_ENABLE_STREAMING=true
NEXT_PUBLIC_ENABLE_DARK_MODE=false
NEXT_PUBLIC_ENABLE_DOCUMENT_PREVIEW=false

# Development
NEXT_PUBLIC_DEBUG_MODE=false
```

### 4.2 Create `.env.local`

```bash
# Copy from .env.example and customize for local development
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
NEXT_PUBLIC_QDRANT_URL=http://localhost:6333
NEXT_PUBLIC_ENABLE_STREAMING=true
```

### 4.3 Create `.env.production`

```bash
# Production environment
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
NEXT_PUBLIC_ENABLE_STREAMING=true
```

### 4.4 Update `.gitignore`

```bash
# Add to existing .gitignore
.env.local
.env.*.local
.env.development.local
.env.test.local
.env.production.local

# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production
.next/
out/
dist/
build/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
```

---

## 5. Next.js Configuration

### 5.1 Update `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Image optimization
  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
  },

  // Internationalization (if needed)
  i18n: {
    locales: ['en'],
    defaultLocale: 'en',
  },

  // Headers for security
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
      ],
    },
  ],

  // Redirects (optional)
  redirects: async () => [
    {
      source: '/',
      destination: '/chat',
      permanent: false,
    },
  ],
};

module.exports = nextConfig;
```

---

## 6. Package.json Scripts

### 6.1 Update `package.json` Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint src --max-warnings 0",
    "lint:fix": "eslint src --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,css}\"",
    "type-check": "tsc --noEmit",
    "generate:types": "openapi-typescript ./openapi.yaml --output ./src/types/api/index.ts",
    "prebuild": "npm run type-check && npm run lint",
    "predev": "npm run generate:types",
    "validate": "npm run type-check && npm run lint"
  }
}
```

---

## 7. Initial Git Setup

### 7.1 Initialize Git Repository

```bash
git init
git add .
git commit -m "chore: Initial Next.js 16 + React 19 project setup

- Configure TypeScript strict mode
- Set up ESLint and Prettier
- Create project folder structure
- Configure environment variables
- Set up Next.js configuration"
```

---

## 8. Verification Checklist

- [ ] Next.js 16 project created
- [ ] All dependencies installed (npm install completes without errors)
- [ ] TypeScript strict mode enabled in tsconfig.json
- [ ] Path aliases configured (@/*, @components/*, etc.)
- [ ] .env.example and .env.local created
- [ ] next.config.js configured
- [ ] package.json scripts configured
- [ ] Git repository initialized and initial commit made
- [ ] `npm run type-check` passes
- [ ] `npm run dev` starts without errors

---

## 9. Run Development Server

### 9.1 Start Development Server

```bash
npm run dev
```

Expected output:
```
> next dev

  ▲ Next.js 16.0.3
  - Local:        http://localhost:3000
```

### 9.2 Test the Server

1. Open http://localhost:3000 in browser
2. Should see Next.js default page or redirect
3. Check console for any errors (should be clean)
4. Check Terminal for any warnings

---

## 10. Troubleshooting

### Issue: "Cannot find module 'react'"
**Solution:** Run `npm install` to ensure all dependencies are installed
```bash
npm install
npm install --save react@19.2.0 react-dom@19.2.0
```

### Issue: "next is not installed"
**Solution:** Explicitly install Next.js
```bash
npm install next@16.0.3
```

### Issue: TypeScript errors in VSCode
**Solution:** Restart TypeScript server
- Press Ctrl+Shift+P (Cmd+Shift+P on Mac)
- Type "TypeScript: Restart TS Server"

### Issue: `.env.local` not being read
**Solution:**
1. Restart dev server after creating .env.local
2. Ensure NEXT_PUBLIC_ prefix for browser-accessible variables
3. Check file is in project root, not in src/

---

## 11. Next Steps

After completing this step:
1. ✅ Verify `npm run dev` works without errors
2. ✅ Verify `npm run type-check` passes
3. → Proceed to **STEP-02-api-client.md**

---

## References

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev/)
- [TypeScript Configuration](https://www.typescriptlang.org/tsconfig)
- [Next.js App Router](https://nextjs.org/docs/app)
