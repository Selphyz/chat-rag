# Step 5: Chat Functionality & Streaming Responses

**Estimated Time:** 2-3 hours
**Prerequisites:** STEP-00 through STEP-04 completed
**Status:** Core feature - Real-time messaging

---

## Overview

This step implements full chat functionality including message streaming, real-time responses, and advanced chat features.

---

## 1. Streaming Setup

### 1.1 Create Stream Message Hook

Create file: `src/hooks/useStreamMessage.ts`

```typescript
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '@/utils/token';
import { useUIContext } from '@/context/UIContext';

export function useStreamMessage(chatId: string) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedMessage, setStreamedMessage] = useState('');
  const queryClient = useQueryClient();
  const { addToast } = useUIContext();

  const sendMessageWithStreaming = async (content: string) => {
    setIsStreaming(true);
    setStreamedMessage('');

    try {
      const token = getAuthToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

      const response = await fetch(`${baseUrl}/chats/${chatId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        setStreamedMessage((prev) => prev + chunk);
      }

      // Invalidate chats to refresh
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Streaming failed';
      addToast(message, 'error');
    } finally {
      setIsStreaming(false);
      setStreamedMessage('');
    }
  };

  return {
    isStreaming,
    streamedMessage,
    sendMessageWithStreaming,
  };
}
```

### 1.2 Enhanced Message Input with Streaming

Create file: `src/components/chat/StreamingMessageInput.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { useStreamMessage } from '@/hooks/useStreamMessage';
import { useSendMessage } from '@/hooks/useChat';
import { useChatUIContext } from '@/context/ChatUIContext';
import { useUIContext } from '@/context/UIContext';

interface StreamingMessageInputProps {
  chatId: string;
  enableStreaming?: boolean;
}

export default function StreamingMessageInput({
  chatId,
  enableStreaming = true,
}: StreamingMessageInputProps) {
  const [input, setInput] = useState('');
  const { mutate: sendMessage, isPending } = useSendMessage(chatId);
  const { isStreaming, sendMessageWithStreaming } = useStreamMessage(chatId);
  const { setIsStreaming } = useChatUIContext();
  const { addToast } = useUIContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    if (enableStreaming && process.env.NEXT_PUBLIC_ENABLE_STREAMING === 'true') {
      await sendMessageWithStreaming(input);
    } else {
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
    }

    setInput('');
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isDisabled) {
              handleSubmit(e as any);
            }
          }}
          placeholder="Ask your AI assistant..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isDisabled || !input.trim()}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isStreaming ? 'Streaming...' : isPending ? 'Sending...' : 'Send'}
        </button>
      </div>

      {isStreaming && (
        <div className="mt-2 text-sm text-gray-600">
          <p>Receiving response...</p>
        </div>
      )}
    </form>
  );
}
```

---

## 2. Advanced Chat Features

### 2.1 Create Chat Actions Component

Create file: `src/components/chat/ChatActions.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { useDeleteChat } from '@/hooks/useChat';
import { useRouter } from 'next/navigation';
import { useUIContext } from '@/context/UIContext';

interface ChatActionsProps {
  chatId: string;
  chatTitle: string;
}

export default function ChatActions({ chatId, chatTitle }: ChatActionsProps) {
  const router = useRouter();
  const { mutate: deleteChat } = useDeleteChat();
  const { addToast } = useUIContext();
  const [showMenu, setShowMenu] = useState(false);

  const handleDelete = () => {
    if (confirm(`Delete chat "${chatTitle}"?`)) {
      deleteChat(chatId, {
        onSuccess: () => {
          addToast('Chat deleted', 'success');
          router.push('/chat');
        },
        onError: () => {
          addToast('Failed to delete chat', 'error');
        },
      });
    }
  };

  const handleClearChat = () => {
    addToast('Clear chat coming soon', 'info');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="rounded-lg p-2 hover:bg-gray-100"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
          <button
            onClick={handleClearChat}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Clear Chat
          </button>

          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete Chat
          </button>
        </div>
      )}
    </div>
  );
}
```

### 2.2 Create Chat Header with Actions

Create file: `src/components/chat/ChatHeader.tsx`

```typescript
'use client';

import React from 'react';
import { useChat } from '@/hooks/useChat';
import ChatActions from './ChatActions';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface ChatHeaderProps {
  chatId: string;
}

export default function ChatHeader({ chatId }: ChatHeaderProps) {
  const { data: chat, isLoading } = useChat(chatId);

  if (isLoading) {
    return <LoadingSpinner size="sm" />;
  }

  return (
    <div className="border-b border-gray-200 p-4 flex justify-between items-center">
      <h2 className="text-lg font-semibold">{chat?.title || 'Chat'}</h2>
      <ChatActions chatId={chatId} chatTitle={chat?.title || 'Chat'} />
    </div>
  );
}
```

### 2.3 Enhanced Chat Detail Page

Update file: `src/app/chat/[id]/page.tsx`

```typescript
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/components/layouts/MainLayout';
import ChatList from '@/components/chat/ChatList';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageList from '@/components/chat/MessageList';
import StreamingMessageInput from '@/components/chat/StreamingMessageInput';

export default function ChatDetailPage() {
  const params = useParams();
  const chatId = params.id as string;

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="grid h-screen grid-cols-1 gap-4 md:grid-cols-4 md:h-[calc(100vh-60px)]">
          {/* Sidebar */}
          <div className="md:col-span-1 hidden md:block">
            <ChatList />
          </div>

          {/* Chat area */}
          <div className="md:col-span-3 flex flex-col">
            <ChatHeader chatId={chatId} />
            <MessageList chatId={chatId} />
            <StreamingMessageInput chatId={chatId} />
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
```

---

## 3. Chat Auto-Refresh

### 3.1 Create Auto-Refresh Hook

Create file: `src/hooks/useAutoRefresh.ts`

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useAutoRefresh(queryKey: unknown[], interval: number = 3000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey });
    }, interval);

    return () => clearInterval(timer);
  }, [queryKey, queryClient, interval]);
}
```

---

## 4. Message Reactions (Optional)

### 4.1 Create Message Reactions Component

Create file: `src/components/chat/MessageReactions.tsx`

```typescript
'use client';

import React from 'react';
import type { Message } from '@/types/api';

interface MessageReactionsProps {
  message: Message;
  onReact: (emoji: string) => void;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export default function MessageReactions({ message, onReact }: MessageReactionsProps) {
  const [showReactions, setShowReactions] = React.useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowReactions(!showReactions)}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        React
      </button>

      {showReactions && (
        <div className="absolute bottom-full mb-2 flex gap-1 bg-white border border-gray-200 rounded-lg p-2 shadow-lg">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                setShowReactions(false);
              }}
              className="text-lg hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 5. Keyboard Shortcuts

### 5.1 Create Keyboard Shortcuts Hook

Create file: `src/hooks/useKeyboardShortcuts.ts`

```typescript
import { useEffect } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  callback: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = !shortcut.ctrl || e.ctrlKey || e.metaKey;
        const shiftMatches = !shortcut.shift || e.shiftKey;
        const altMatches = !shortcut.alt || e.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          e.preventDefault();
          shortcut.callback();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
```

---

## 6. Message Editing (Future)

### 6.1 Create Edit Message Component Skeleton

Create file: `src/components/chat/EditMessage.tsx`

```typescript
'use client';

import React, { useState } from 'react';

interface EditMessageProps {
  messageId: string;
  currentContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export default function EditMessage({
  messageId,
  currentContent,
  onSave,
  onCancel,
}: EditMessageProps) {
  const [content, setContent] = useState(currentContent);

  const handleSave = () => {
    if (content.trim() && content !== currentContent) {
      onSave(content);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-4 py-2"
        rows={3}
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

---

## 7. Verification Checklist

- [ ] Message streaming works (if enabled)
- [ ] Messages display in real-time
- [ ] Chat list updates after sending message
- [ ] Delete chat functionality works
- [ ] Chat title displays correctly
- [ ] Keyboard shortcuts work (Enter to send)
- [ ] Message input clears after sending
- [ ] Loading states display during streaming
- [ ] Error handling for failed messages
- [ ] Auto-refresh of chat data

---

## 8. Next Steps

→ Proceed to **STEP-06-document-management.md**

---

## References

- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [Real-time Messaging Patterns](https://en.wikipedia.org/wiki/WebSocket)
