'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isToolUsing?: boolean;
  toolCompleted?: boolean;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tavilyApiKey, setTavilyApiKey] = useState('');
  const [hasEnvKey, setHasEnvKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 環境変数にAPIキーがあるかチェック
  useEffect(() => {
    fetch('/api/check-env')
      .then(res => res.json())
      .then(data => {
        setHasEnvKey(data.hasTavilyKey);
      })
      .catch(console.error);
  }, []);

  // メッセージが更新されたら最下部にスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // ユーザーメッセージを追加
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // 思考中プレースホルダーを追加
    setMessages(prev => [...prev, { role: 'assistant', content: '', isToolUsing: false }]);

    try {
      // Lambda Function URLを直接呼び出す (ストリーミング優先)
      // 環境変数から取得、なければ従来のAPI Routeにフォールバック
      const apiUrl = process.env.NEXT_PUBLIC_LAMBDA_FUNCTION_URL || '/api/chat';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          tavilyApiKey: tavilyApiKey || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // ストリームを読み取る
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let currentBuffer = '';           // 現在蓄積中のテキスト
      let isInToolUse = false;          // ツール使用中フラグ
      let toolUseMessageIndex = -1;     // ツール使用インジケーターのメッセージインデックス

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const jsonStr = line.slice(6); // "data: " を除去
            const event = JSON.parse(jsonStr);

            // ツール使用イベント
            if (event.type === 'tool_use') {
              isInToolUse = true;
              const savedBuffer = currentBuffer;

              setMessages((prev) => {
                const newMessages = [...prev];
                if (savedBuffer) {
                  // 既存のテキストを確定 + ツールインジケーターを追加
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: savedBuffer,
                    isToolUsing: false,
                  };
                  toolUseMessageIndex = newMessages.length;
                  newMessages.push({ role: 'assistant', content: '', isToolUsing: true, toolCompleted: false });
                } else {
                  // テキストがない場合は思考中をツールインジケーターに置き換え
                  toolUseMessageIndex = newMessages.length - 1;
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: '',
                    isToolUsing: true,
                    toolCompleted: false
                  };
                }
                return newMessages;
              });

              // バッファをリセット(次のテキストは新しい吹き出し用)
              currentBuffer = '';
            } else if (event.type === 'text') {
              console.log('[DEBUG] Text event:', { isInToolUse, currentBuffer: currentBuffer.substring(0, 50), toolUseMessageIndex });

              if (isInToolUse && currentBuffer === '') {
                console.log('[DEBUG] First text after tool use - marking tool as completed', 'toolUseMessageIndex:', toolUseMessageIndex);
                // ツール使用後の最初のテキスト
                // ツールインジケーターを完了状態に変更 + 新しいメッセージを追加(1回の更新で)
                const newText = event.data;
                const savedToolIndex = toolUseMessageIndex;  // クロージャ用にキャプチャ

                setMessages((prev) => {
                  console.log('[DEBUG] setMessages callback - prev.length:', prev.length, 'savedToolIndex:', savedToolIndex);
                  const newMessages = [...prev];

                  // ツールインジケーターを完了状態に変更
                  if (savedToolIndex >= 0 && savedToolIndex < newMessages.length) {
                    console.log('[DEBUG] Updating tool message at index:', savedToolIndex, 'Message:', newMessages[savedToolIndex]);
                    newMessages[savedToolIndex] = {
                      ...newMessages[savedToolIndex],
                      toolCompleted: true,
                    };
                    console.log('[DEBUG] Updated message:', newMessages[savedToolIndex]);
                  } else {
                    console.log('[DEBUG] Condition failed! savedToolIndex:', savedToolIndex, 'newMessages.length:', newMessages.length);
                  }

                  // 新しいメッセージを追加
                  newMessages.push({
                    role: 'assistant',
                    content: newText,
                    isToolUsing: false
                  });

                  return newMessages;
                });

                currentBuffer = newText;
                // ツール使用完了フラグをリセット
                isInToolUse = false;
                toolUseMessageIndex = -1;
              } else {
                // 通常のテキスト蓄積
                currentBuffer += event.data;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: currentBuffer,
                    isToolUsing: false,
                  };
                  return newMessages;
                });
              }
            }
          } catch (parseError) {
            console.error('Parse error:', parseError);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
          isToolUsing: false,
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* サイドバー設定 - 環境変数にAPIキーがない場合のみ表示 */}
      {!hasEnvKey && (
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <div className="max-w-4xl mx-auto">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tavily APIキー
            </label>
            <input
              type="password"
              value={tavilyApiKey}
              onChange={(e) => setTavilyApiKey(e.target.value)}
              placeholder="tvly-..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tavily APIキーは <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">tavily.com</a> で取得できます
            </p>
          </div>
        </div>
      )}

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p>メッセージを入力して会話を始めましょう</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                {/* 思考中スピナー(アシスタントメッセージが空の場合) */}
                {message.role === 'assistant' && !message.content && !message.isToolUsing && (
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                    思考中...
                  </div>
                )}

                {/* ツール使用インジケーター */}
                {message.isToolUsing && (
                  <div className={`flex items-center gap-2 text-sm ${message.toolCompleted ? 'text-green-600' : 'text-blue-600'}`}>
                    {(() => {
                      console.log(`[UI DEBUG] Message ${index}:`, { isToolUsing: message.isToolUsing, toolCompleted: message.toolCompleted });
                      return null;
                    })()}
                    {message.toolCompleted ? (
                      <span className="inline-block w-4 h-4">✓</span>
                    ) : (
                      <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                    )}
                    🔍 Tavily検索ツール{message.toolCompleted ? 'を利用しました' : 'を利用しています'}
                  </div>
                )}

                {/* メッセージ本文 */}
                {message.content && (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        // リンクを新しいタブで開く
                        a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" />,
                        // コードブロックのスタイリング
                        code: ({ className, children, ...props }) => {
                          const isInline = !className;
                          return isInline ? (
                            <code {...props} className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">
                              {children}
                            </code>
                          ) : (
                            <code {...props} className="block bg-gray-100 p-2 rounded text-sm font-mono overflow-x-auto">
                              {children}
                            </code>
                          );
                        },
                        // リストのスタイリング
                        ul: ({ ...props }) => <ul {...props} className="list-disc list-inside my-2" />,
                        ol: ({ ...props }) => <ol {...props} className="list-decimal list-inside my-2" />,
                        // 段落のスタイリング
                        p: ({ ...props }) => <p {...props} className="my-2" />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 入力エリア */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '送信中...' : '送信'}
          </button>
        </form>
      </div>
    </div>
  );
}
