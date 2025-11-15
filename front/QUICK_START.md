# Quick Start Guide - Chat RAG Frontend

## Foundation Setup Complete ✅

The frontend foundation has been fully configured with:
- OpenAPI type generation from backend spec
- Type-safe API client with interceptors
- React Query for state management
- Context API for UI state
- Authentication system ready
- Design system with CSS variables
- All TypeScript strict mode enabled

---

## Project Structure at a Glance

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page (redirects)
│   ├── globals.css        # Global styles
│   └── auth/              # Auth pages (login, register)
├── types/                 # Type definitions
│   ├── api/              # OpenAPI-generated types (auto)
│   └── index.ts          # App-level types
├── services/             # API and external services
│   └── api/
│       ├── client.ts     # Type-safe API client
│       └── queryClient.ts # React Query config
├── contexts/             # Global state
│   ├── AuthContext.tsx   # Authentication state
│   └── UIContext.tsx     # UI state
├── hooks/                # Custom React hooks
│   ├── useAuth.ts        # Auth hooks
│   ├── useChat.ts        # Chat hooks
│   └── useDocuments.ts   # Document hooks
├── components/           # React components
│   ├── RootProviders.tsx # Provider wrapper
│   └── AuthForm.tsx      # Auth form component
└── utils/                # Utility functions
    ├── validation.ts
    └── helpers.ts
```

---

## Getting Started

### 1. Install Dependencies
```bash
cd front
npm install
```

### 2. Generate Types from Backend
```bash
# Ensure backend openapi.yaml is in the root directory
npm run generate:types
```

### 3. Start Development Server
```bash
npm run dev
```

Server runs at: `http://localhost:3000`

---

## Development Workflow

### Watch Mode for Type Changes
```bash
# In one terminal
npm run dev

# In another terminal (optional)
npm run generate:types:watch
```

### Type Safety
All API interactions are type-safe from the OpenAPI spec:

```typescript
// Fully typed API calls
import { useLogin } from '@/hooks';

const { mutate: login } = useLogin();

// The request and response are fully typed
await login({ email: 'user@example.com', password: '...' });
```

---

## Next Steps - Building Features

### Step 1: Create Auth Pages
Implement login and register pages using the `AuthForm` component:

```typescript
// src/app/auth/login/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useLogin } from '@/hooks';
import { AuthForm } from '@/components/AuthForm';

export default function LoginPage() {
  const router = useRouter();
  const { mutate: login, isPending, error } = useLogin();

  const handleSubmit = async (data: Record<string, string>) => {
    await login(
      { email: data.email, password: data.password },
      {
        onSuccess: () => router.push('/chat'),
      }
    );
  };

  return (
    <AuthForm
      title="Login"
      fields={[
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'password', label: 'Password', type: 'password', required: true },
      ]}
      submitButtonText="Login"
      isLoading={isPending}
      error={error?.message}
      onSubmit={handleSubmit}
      footerLink={{
        text: 'Sign up',
        href: '/auth/register',
        label: 'Don\'t have an account?',
      }}
    />
  );
}
```

### Step 2: Create Main Layout
Build the main app layout with sidebar and header:
- Chat list sidebar
- User menu dropdown
- Mobile responsive navigation

### Step 3: Implement Chat Interface
- Message display component
- Message input with markdown support
- Chat creation and deletion
- Real-time message streaming

### Step 4: Build Document Management
- File upload with drag-drop
- Document list with filters
- Processing status tracking
- Delete functionality

---

## API Integration Examples

### Using the API Client Directly
```typescript
import { apiClient } from '@/services/api';

// GET request (type-safe)
const chats = await apiClient.get<Chat[]>('/chats');

// POST request with type safety
const newChat = await apiClient.post<Chat>('/chats', {
  title: 'New Chat'
});

// File upload
const formData = new FormData();
formData.append('files', file);
const result = await apiClient.uploadFile('/documents', formData);
```

### Using React Query Hooks
```typescript
import { useChats, useSendMessage } from '@/hooks';

export function ChatComponent() {
  const { data: chats, isLoading } = useChats();
  const { mutate: sendMessage } = useSendMessage('chatId');

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {chats?.map(chat => (
        <div key={chat.id}>{chat.title}</div>
      ))}
    </div>
  );
}
```

### Using Authentication
```typescript
import { useAuth } from '@/contexts';

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <div>
      <p>{user?.email}</p>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}
```

---

## Building & Deploying

### Production Build
```bash
npm run build
npm start
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

---

## Environment Setup

Create `.env.local` in project root:
```bash
# API endpoint
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# App branding
NEXT_PUBLIC_APP_NAME=Chat RAG
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Feature flags
NEXT_PUBLIC_ENABLE_STREAMING=true
NEXT_PUBLIC_ENABLE_DARK_MODE=true
```

---

## Important Notes

### Type Generation
- Types are auto-generated from `openapi.yaml`
- They're regenerated on build and dev startup
- Always run `npm run generate:types` after backend API changes
- Commit generated types to git

### Token Management
- JWT tokens stored in localStorage
- Auto-injected in all API requests
- Auto-logout on 401 errors
- Token loaded on app initialization

### API Error Handling
- All API errors are caught and handled
- 401 errors trigger logout and redirect
- Error messages shown in UI via context
- Toast notifications for user feedback

---

## Troubleshooting

### Build Fails with Type Errors
```bash
# Regenerate types
npm run generate:types

# Clear cache and rebuild
rm -rf .next
npm run build
```

### Types Not Updating
```bash
# Regenerate from OpenAPI spec
npm run generate:types

# Or watch for changes
npm run generate:types:watch
```

### Dev Server Won't Start
```bash
# Clear Node modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### CORS Errors
Ensure backend allows requests from frontend:
- Check backend CORS configuration
- Verify `NEXT_PUBLIC_API_URL` is correct
- Test API endpoint with curl or Postman

---

## Project Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Create optimized production build |
| `npm start` | Run production server |
| `npm run lint` | Check code quality |
| `npm run generate:types` | Generate types from openapi.yaml |
| `npm run generate:types:watch` | Watch and auto-generate types |
| `npm run type-check` | Run TypeScript strict check |

---

## Resources

- [Next.js 16 Docs](https://nextjs.org/docs)
- [React 19 Docs](https://react.dev)
- [TanStack React Query](https://tanstack.com/query/latest)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [OpenAPI Specification](https://spec.openapis.org/)

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│      Next.js 16 (React 19)         │
├─────────────────────────────────────┤
│  Components                          │
│  ├── Use Context API (Auth, UI)     │
│  ├── Use React Query (Server State) │
│  └── Use Custom Hooks               │
├─────────────────────────────────────┤
│  React Query Cache                   │
│  (Server State Management)           │
├─────────────────────────────────────┤
│  Context Providers                   │
│  ├── AuthContext (JWT, User)        │
│  └── UIContext (Theme, Notify)      │
├─────────────────────────────────────┤
│  API Client                          │
│  ├── Request Interceptors (JWT)     │
│  ├── Response Interceptors (401)    │
│  └── Type-Safe Requests             │
├─────────────────────────────────────┤
│  OpenAPI Generated Types             │
│  (From Backend Spec)                │
└─────────────────────────────────────┘
         ↓ HTTPS ↓
    Backend API (NestJS)
```

---

**Ready to start building! 🚀**

Next: Create login/register pages following STEP-03-authentication.md
