# Step 4: Chat Interface & UI Components

**Estimated Time:** 3-4 hours
**Prerequisites:** STEP-00 through STEP-03 completed
**Status:** Core feature - Chat UI foundation

---

## Overview

This step builds the chat interface components including sidebar, message display, input, and layouts.

---

## 1. Chat Components

### 1.1 Create Chat Context

Create file: `src/context/ChatUIContext.tsx`

```typescript
'use client';

import React, { createContext, useContext, useState } from 'react';

interface ChatUIContextType {
  selectedChatId: string | null;
  setSelectedChatId: (id: string | null) => void;
  messageInput: string;
  setMessageInput: (input: string) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  selectedDocuments: string[];
  setSelectedDocuments: (docs: string[]) => void;
}

const ChatUIContext = createContext<ChatUIContextType | undefined>(undefined);

export function ChatUIProvider({ children }: { children: React.ReactNode }) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  return (
    <ChatUIContext.Provider
      value={{
        selectedChatId,
        setSelectedChatId,
        messageInput,
        setMessageInput,
        isStreaming,
        setIsStreaming,
        selectedDocuments,
        setSelectedDocuments,
      }}
    >
      {children}
    </ChatUIContext.Provider>
  );
}

export function useChatUIContext() {
  const context = useContext(ChatUIContext);
  if (!context) {
    throw new Error('useChatUIContext must be used within ChatUIProvider');
  }
  return context;
}
```

### 1.2 Create Chat List Item Component

Create file: `src/components/chat/ChatListItem.tsx`

```typescript
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { Chat } from '@/types/api';
import { useChatUIContext } from '@/context/ChatUIContext';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onDelete: (id: string) => void;
}

export default function ChatListItem({ chat, isActive, onDelete }: ChatListItemProps) {
  const router = useRouter();
  const { setSelectedChatId } = useChatUIContext();

  const handleClick = () => {
    setSelectedChatId(chat.id);
    router.push(`/chat/${chat.id}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this chat?')) {
      onDelete(chat.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer rounded-lg px-3 py-2 transition-colors ${
        isActive ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
      }`}
    >
      <h3 className="truncate font-medium">{chat.title}</h3>
      <p className="text-xs text-gray-500 truncate">
        {chat.messages?.[0]?.content?.substring(0, 40) || 'No messages'}
      </p>
      <button
        onClick={handleDelete}
        className="mt-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  );
}
```

### 1.3 Create Chat List Component

Create file: `src/components/chat/ChatList.tsx`

```typescript
'use client';

import React from 'react';
import { useChats, useDeleteChat, useCreateChat } from '@/hooks/useChat';
import ChatListItem from './ChatListItem';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useChatUIContext } from '@/context/ChatUIContext';
import { useUIContext } from '@/context/UIContext';

export default function ChatList() {
  const { data: chats, isLoading } = useChats();
  const { mutate: deleteChat } = useDeleteChat();
  const { mutate: createChat } = useCreateChat();
  const { selectedChatId } = useChatUIContext();
  const { addToast } = useUIContext();

  const handleNewChat = () => {
    createChat(
      { title: 'New Chat' },
      {
        onSuccess: () => {
          addToast('New chat created', 'success');
        },
        onError: () => {
          addToast('Failed to create chat', 'error');
        },
      }
    );
  };

  if (isLoading) {
    return <LoadingSpinner size="sm" />;
  }

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={handleNewChat}
        className="mb-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        + New Chat
      </button>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {chats?.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isActive={chat.id === selectedChatId}
            onDelete={() => deleteChat(chat.id)}
          />
        ))}
      </div>

      {!chats?.length && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <p>No chats yet</p>
        </div>
      )}
    </div>
  );
}
```

### 1.4 Create Message Component

Create file: `src/components/chat/Message.tsx`

```typescript
'use client';

import React from 'react';
import type { Message } from '@/types/api';

interface MessageProps {
  message: Message;
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`rounded-lg px-4 py-2 max-w-md ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-900'
        }`}
      >
        <p className="text-sm">{message.content}</p>
        <p className="text-xs mt-1 opacity-70">
          {new Date(message.createdAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
```

### 1.5 Create Message List Component

Create file: `src/components/chat/MessageList.tsx`

```typescript
'use client';

import React, { useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import Message from './Message';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface MessageListProps {
  chatId: string;
}

export default function MessageList({ chatId }: MessageListProps) {
  const { data: chat, isLoading } = useChat(chatId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!chat?.messages?.length) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <p>No messages yet. Start a conversation!</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-4">
      {chat.messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
```

### 1.6 Create Message Input Component

Create file: `src/components/chat/MessageInput.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { useSendMessage } from '@/hooks/useChat';
import { useChatUIContext } from '@/context/ChatUIContext';
import { useUIContext } from '@/context/UIContext';

interface MessageInputProps {
  chatId: string;
}

export default function MessageInput({ chatId }: MessageInputProps) {
  const [input, setInput] = useState('');
  const { mutate: sendMessage, isPending } = useSendMessage(chatId);
  const { isStreaming } = useChatUIContext();
  const { addToast } = useUIContext();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    sendMessage(
      { content: input },
      {
        onSuccess: () => {
          setInput('');
        },
        onError: () => {
          addToast('Failed to send message', 'error');
        },
      }
    );
  };

  const isDisabled = isPending || isStreaming;

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isDisabled}
          placeholder="Ask your AI assistant..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isDisabled || !input.trim()}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  );
}
```

---

## 2. Chat Page

### 2.1 Create Chat Page

Create file: `src/app/chat/page.tsx`

```typescript
'use client';

import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/components/layouts/MainLayout';
import ChatList from '@/components/chat/ChatList';
import { useChats } from '@/hooks/useChat';
import { useChatUIContext } from '@/context/ChatUIContext';

export default function ChatIndexPage() {
  const { data: chats } = useChats();
  const { setSelectedChatId } = useChatUIContext();

  React.useEffect(() => {
    if (chats?.length && !window.location.pathname.endsWith('/chat/')) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, setSelectedChatId]);

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-4">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <ChatList />
          </div>

          {/* Empty state */}
          <div className="md:col-span-3 flex items-center justify-center text-gray-500">
            <p>Select a chat or create a new one</p>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
```

### 2.2 Create Chat Detail Page

Create file: `src/app/chat/[id]/page.tsx`

```typescript
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/components/layouts/MainLayout';
import ChatList from '@/components/chat/ChatList';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';

export default function ChatDetailPage() {
  const params = useParams();
  const chatId = params.id as string;

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-4">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <ChatList />
          </div>

          {/* Chat area */}
          <div className="md:col-span-3 flex flex-col">
            <MessageList chatId={chatId} />
            <MessageInput chatId={chatId} />
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
```

---

## 3. Empty States & Loading Skeletons

### 3.1 Create Skeleton Components

Create file: `src/components/chat/MessageSkeleton.tsx`

```typescript
export default function MessageSkeleton() {
  return (
    <div className="mb-4 flex justify-start">
      <div className="rounded-lg bg-gray-200 px-4 py-2 w-48 h-12 animate-pulse" />
    </div>
  );
}
```

### 3.2 Create Empty Chat State

Create file: `src/components/chat/EmptyChat.tsx`

```typescript
export default function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <svg
        className="h-16 w-16 mb-4 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <h2 className="text-xl font-semibold mb-2">Start a Conversation</h2>
      <p>Click on a chat to continue or create a new one</p>
    </div>
  );
}
```

---

## 4. Verification Checklist

- [ ] ChatUIContext created
- [ ] Chat list displays all chats
- [ ] Chat list items show title and preview
- [ ] New chat button works
- [ ] Chat messages display with timestamps
- [ ] Message input sends messages
- [ ] Navigation between chats works
- [ ] Empty states display properly
- [ ] Loading states display
- [ ] Mobile responsive layout

---

## 5. Next Steps

→ Proceed to **STEP-05-chat-functionality.md**

---

## References

- [React Hooks](https://react.dev/reference/react)
- [Next.js Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Tailwind CSS](https://tailwindcss.com/)
