'use client';

import ChatInterface from '@/components/ChatInterface';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

export default function Home() {
  return (
    <Authenticator
      loginMechanisms={['email']}
      signUpAttributes={['email']}
      formFields={{
        signUp: {
          email: {
            label: 'メールアドレス',
            placeholder: 'example@example.com',
            isRequired: true,
          },
          password: {
            label: 'パスワード',
            placeholder: '8文字以上(大文字・小文字・数字・記号を含む)',
            isRequired: true,
          },
          confirm_password: {
            label: 'パスワード(確認)',
          },
        },
      }}
    >
      {({ signOut, user }) => (
        <div className="flex flex-col h-screen">
          {/* ヘッダーにユーザー情報とサインアウトボタンを追加 */}
          <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">なんでも検索エージェント</h1>
              <p className="text-sm text-gray-600 mt-1">
                Strands AgentsがMCPサーバーを使って情報収集します!
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ログイン中: <span className="font-semibold">{user?.signInDetails?.loginId}</span>
              </p>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              サインアウト
            </button>
          </div>

          {/* チャットインターフェース */}
          <div className="flex-1 overflow-hidden">
            <ChatInterface />
          </div>
        </div>
      )}
    </Authenticator>
  );
}
