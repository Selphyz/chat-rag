# Chat RAG Frontend - Development Guide

**Complete Step-by-Step Implementation Guide**
**Version:** 1.0
**Last Updated:** 2025-11-15

---

## Table of Contents

1. [Overview](#overview)
2. [Development Timeline](#development-timeline)
3. [File Structure Guide](#file-structure-guide)
4. [Quick Reference](#quick-reference)
5. [Development Commands](#development-commands)
6. [Key Technologies](#key-technologies)

---

## Overview

This development guide provides a structured, step-by-step approach to building the Chat RAG frontend application. Each STEP file is designed to be completed sequentially and includes:

- **Overview**: What will be built
- **Prerequisites**: Required before starting
- **Detailed Instructions**: Code examples and explanations
- **Verification Checklists**: Ensure completion
- **Troubleshooting**: Common issues and solutions
- **Next Steps**: Transition to the next phase

---

## Development Timeline

### Week 1: Foundation & Auth
- **STEP-00** (1-2 hrs): OpenAPI Type Generation Setup
- **STEP-01** (2-3 hrs): Next.js Project Setup
- **STEP-02** (2-3 hrs): Type-Safe API Client
- **STEP-03** (3-4 hrs): Authentication Pages & Context

**Total Week 1: ~9-12 hours**

### Week 2: Chat Interface & Core Features
- **STEP-04** (3-4 hrs): Chat Interface Components
- **STEP-05** (2-3 hrs): Chat Functionality & Streaming
- **STEP-06** (3-4 hrs): Document Management

**Total Week 2: ~8-11 hours**

### Week 3+: Polish & Optimization
- Responsive Design Refinement
- Performance Optimization
- Error Handling & Edge Cases
- Testing & Quality Assurance
- Deployment Preparation

---

## File Structure Guide

### Quick Links to Implementation Files

```
frontend/
├── STEP-00-openapi-setup.md          ← START HERE
│   └── Covers: Type generation, build scripts, CI/CD
│
├── STEP-01-project-setup.md
│   └── Covers: Next.js init, dependencies, folder structure
│
├── STEP-02-api-client.md
│   └── Covers: API client, services, React Query hooks
│
├── STEP-03-authentication.md
│   └── Covers: Auth flows, contexts, protected routes
│
├── STEP-04-chat-interface.md
│   └── Covers: Chat UI components, layouts, messages
│
├── STEP-05-chat-functionality.md
│   └── Covers: Streaming, message sending, chat actions
│
├── STEP-06-document-management.md
│   └── Covers: File upload, document list, processing
│
└── DEVELOPMENT_GUIDE.md (this file)
```

### Created Directory Structure

```
src/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout with providers
│   ├── page.tsx                      # Home/redirect page
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── chat/
│   │   ├── page.tsx                  # Chat list
│   │   └── [id]/page.tsx             # Chat detail
│   ├── documents/page.tsx            # Document management
│   └── profile/page.tsx              # User profile
│
├── components/                       # React components
│   ├── layouts/
│   │   ├── MainLayout.tsx
│   │   └── AuthLayout.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── ChatPage.tsx
│   │   ├── DocumentsPage.tsx
│   │   └── ProfilePage.tsx
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── Toast.tsx
│   │   └── ConfirmDialog.tsx
│   ├── forms/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── DocumentUploadForm.tsx
│   ├── chat/
│   │   ├── ChatList.tsx
│   │   ├── ChatListItem.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── ChatActions.tsx
│   │   ├── MessageList.tsx
│   │   ├── Message.tsx
│   │   ├── MessageInput.tsx
│   │   ├── StreamingMessageInput.tsx
│   │   ├── DocumentSelector.tsx
│   │   ├── MessageReactions.tsx
│   │   └── EditMessage.tsx
│   └── documents/
│       ├── FileUploadDropZone.tsx
│       ├── DocumentList.tsx
│       ├── DocumentListItem.tsx
│       ├── DocumentStatusBadge.tsx
│       └── FileIcon.tsx
│
├── hooks/                            # React hooks
│   ├── useAuth.ts                    # Auth hooks (login, register, profile)
│   ├── useChat.ts                    # Chat hooks (CRUD operations)
│   ├── useDocuments.ts               # Document hooks (upload, delete)
│   ├── useStreamMessage.ts           # Streaming responses
│   ├── useAutoRefresh.ts             # Auto-refresh data
│   ├── useKeyboardShortcuts.ts       # Keyboard shortcuts
│   └── useDocumentStatusMonitor.ts   # Document processing monitoring
│
├── services/
│   └── api/
│       ├── client.ts                 # Base API client with interceptors
│       ├── auth.ts                   # Authentication API
│       ├── chat.ts                   # Chat API
│       └── documents.ts              # Document API
│
├── context/                          # React Context providers
│   ├── AuthContext.tsx               # Authentication state
│   ├── UIContext.tsx                 # UI state (sidebar, toasts)
│   ├── ChatUIContext.tsx             # Chat UI state
│   └── DocumentContext.tsx           # Document selection state
│
├── types/
│   └── api/
│       └── index.ts                  # Generated OpenAPI types
│
├── utils/
│   ├── token.ts                      # JWT token management
│   ├── validation.ts                 # Form validation rules
│   ├── errors.ts                     # Error handling utilities
│   └── formatters.ts                 # Data formatters
│
├── constants/
│   ├── api.ts                        # API URLs and constants
│   ├── validation.ts                 # Validation rules
│   └── messages.ts                   # User messages
│
├── styles/
│   ├── theme.ts                      # Styled components theme
│   ├── global.ts                     # Global styles
│   └── colors.ts                     # Color palette
│
└── lib/
    └── queryClient.ts                # React Query configuration
```

---

## Quick Reference

### By Feature

#### Authentication
- **STEP-03**: AuthContext, Login/Register pages, Protected routes
- Files: `src/context/AuthContext.tsx`, `src/hooks/useAuth.ts`, `src/components/forms/`

#### Chat System
- **STEP-04**: Chat list, message display, layouts
- **STEP-05**: Message sending, streaming, actions
- Files: `src/components/chat/`, `src/hooks/useChat.ts`

#### Document Management
- **STEP-06**: Upload, list, status tracking
- Files: `src/components/documents/`, `src/hooks/useDocuments.ts`

#### API Integration
- **STEP-02**: API client, services, React Query
- Files: `src/services/api/`, `src/lib/queryClient.ts`

### By Technology

#### React & Next.js
- App Router (Next.js 16)
- React 19 with hooks
- Context API for state

#### State Management
- React Query for server state
- Context API for UI state
- Custom hooks for logic

#### Styling
- Tailwind CSS (TailwindUI patterns)
- Styled Components (optional, for complex theming)

#### Forms & Validation
- React Hook Form
- Zod for schema validation

#### Type Safety
- Generated from OpenAPI spec
- TypeScript strict mode

---

## Development Commands

### Setup
```bash
# Install dependencies
npm install

# Generate API types
npm run generate:types

# Start development server
npm run dev
```

### Development
```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
```

### Build & Deployment
```bash
# Production build
npm run build

# Start production server
npm start

# Validate before build
npm run validate
```

---

## Key Technologies

### Core Framework
- **Next.js 16**: React metaframework with App Router
- **React 19**: Latest React with hooks
- **TypeScript 5.9**: Strict mode enabled

### Data Management
- **@tanstack/react-query 4**: Server state, caching, synchronization
- **React Context API**: UI state management
- **React Hook Form 7**: Efficient form handling
- **Zod 3**: Schema validation

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Styled Components** (optional): CSS-in-JS for complex theming

### API & HTTP
- **Fetch API**: Built-in, no external dependency
- **OpenAPI TypeScript**: Auto-generated types
- **Custom API Client**: With interceptors and error handling

### Development Tools
- **ESLint 9**: Code quality
- **Prettier 3**: Code formatting
- **TypeScript**: Type safety

---

## Implementation Order

### Phase 1: Foundation (Days 1-2)
1. Complete STEP-00: OpenAPI setup
2. Complete STEP-01: Project initialization
3. Verify all tools work correctly

### Phase 2: Infrastructure (Days 2-3)
1. Complete STEP-02: API client
2. Test with simple API calls
3. Verify type generation works

### Phase 3: Authentication (Days 3-4)
1. Complete STEP-03: Auth flows
2. Test login/register
3. Verify protected routes

### Phase 4: Core Features (Days 4-6)
1. Complete STEP-04: Chat UI
2. Complete STEP-05: Chat functionality
3. Test messaging end-to-end

### Phase 5: Document Management (Days 6-7)
1. Complete STEP-06: Document upload
2. Test file handling
3. Verify processing status

### Phase 6: Polish & Deploy (Days 7+)
1. Responsive design refinement
2. Performance optimization
3. Error handling improvements
4. Testing & QA
5. Deployment

---

## Success Indicators

✅ After STEP-00:
- Type generation works
- Build scripts configured
- No TypeScript errors

✅ After STEP-01:
- Development server runs
- All dependencies installed
- Project structure in place

✅ After STEP-02:
- API client functional
- React Query configured
- Services ready for use

✅ After STEP-03:
- Login/register pages work
- Auth context manages state
- Protected routes enforce auth

✅ After STEP-04:
- Chat interface displays
- Component hierarchy correct
- Responsive layout works

✅ After STEP-05:
- Messages send and display
- Streaming works (if enabled)
- Chat actions functional

✅ After STEP-06:
- File upload works
- Document list displays
- Status tracking works

---

## Common Pitfalls & Solutions

### Types Not Generating
→ Check `openapi.yaml` is valid and in root directory
→ Run `npm run generate:types` manually
→ Verify tsconfig paths are correct

### API Calls Failing
→ Ensure backend is running
→ Check `NEXT_PUBLIC_API_URL` is correct
→ Verify JWT token in localStorage

### Context Not Working
→ Ensure providers wrap entire app in layout
→ Check Context is exported correctly
→ Verify hook import path is correct

### Styling Issues
→ Ensure Tailwind CSS is in `globals.css`
→ Check class names are correct
→ Rebuild CSS: `npm run build`

### TypeScript Errors
→ Run `npm run type-check` to find all errors
→ Check generated types exist
→ Verify path aliases in tsconfig

---

## Testing Your Implementation

### Manual Testing Checklist

- [ ] **Auth Flow**: Register → Login → Logout → Redirects
- [ ] **Chat**: Create → Send message → See response → Delete
- [ ] **Documents**: Upload → See in list → Delete
- [ ] **Protection**: Try accessing /chat without auth → Redirects to login
- [ ] **Types**: All API calls are type-safe
- [ ] **Errors**: Error messages display on failures
- [ ] **Mobile**: Layout works on mobile devices
- [ ] **Performance**: Pages load in < 3 seconds

### Integration Testing

```bash
# After backend is deployed
npm run validate
npm run type-check
npm run lint
npm run build
npm start
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All STEP files completed
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No lint warnings: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass
- [ ] Environment variables configured
- [ ] Backend API is accessible
- [ ] Error handling comprehensive
- [ ] Loading states complete
- [ ] Responsive design verified

---

## Getting Help

If you get stuck:

1. **Check the STEP file** - Each file has troubleshooting sections
2. **Review code examples** - All examples are provided in STEP files
3. **Check error messages** - They're usually very descriptive
4. **Test in isolation** - Create simple test files to verify features
5. **Use TypeScript strict mode** - It catches many issues early

---

## Next Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

---

## Development Team Notes

### Code Quality Standards
- TypeScript strict mode enabled
- ESLint rules enforced
- Prettier formatting required
- Meaningful commit messages
- Component documentation

### Component Guidelines
- Functional components only
- Custom hooks for logic
- Props properly typed
- Error boundaries for safety
- Loading states for UX

### API Integration Standards
- All types from OpenAPI spec
- Error handling for all requests
- Loading/error states shown
- Optimistic updates where applicable
- Request deduplication via React Query

### Styling Guidelines
- Tailwind utility-first approach
- Consistent spacing (4px base unit)
- Color palette from design system
- Responsive breakpoints: mobile-first
- Accessibility considerations

---

**Last Updated:** November 15, 2025
**Status:** Ready for Development
**Version:** 1.0
