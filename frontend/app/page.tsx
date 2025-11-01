'use client';

import ChatInterface from '@/components/ChatInterface';
import { Authenticator, translations, useAuthenticator } from '@aws-amplify/ui-react';
import { I18n } from 'aws-amplify/utils';
import '@aws-amplify/ui-react/styles.css';

// 日本語翻訳を設定
I18n.putVocabularies(translations);
I18n.setLanguage('ja');

// カスタム日本語翻訳
I18n.putVocabularies({
  ja: {
    'Sign In': 'サインイン',
    'Sign Up': '新規登録',
    'Sign Out': 'サインアウト',
    'Sign in': 'サインイン',
    'Sign up': '新規登録',
    'Email': 'メールアドレス',
    'Password': 'パスワード',
    'Confirm Password': 'パスワード（確認）',
    'Enter your Email': 'メールアドレスを入力',
    'Enter your Password': 'パスワードを入力',
    'Please confirm your Password': 'パスワードを再入力',
    'Forgot your password?': 'パスワードをお忘れですか？',
    'Reset Password': 'パスワードをリセット',
    'Reset your password': 'パスワードをリセット',
    'Back to Sign In': 'サインインに戻る',
    'Send code': '確認コードを送信',
    'Code': '確認コード',
    'New Password': '新しいパスワード',
    'Submit': '送信',
    'Code *': '確認コード *',
    'New password': '新しいパスワード',
    'Your passwords must match': 'パスワードが一致しません',
    'Incorrect username or password.': 'メールアドレスまたはパスワードが正しくありません',
    'User does not exist.': 'ユーザーが存在しません',
    'User already exists': 'このメールアドレスは既に登録されています',
    'Invalid password format': 'パスワードの形式が正しくありません',
    'Account recovery requires verified contact information': 'アカウント復旧には確認済みの連絡先が必要です',
    'Invalid verification code provided, please try again.': '確認コードが正しくありません。もう一度お試しください',
    'Username cannot be empty': 'メールアドレスを入力してください',
    'Password cannot be empty': 'パスワードを入力してください',
    'Password must have at least 8 characters': 'パスワードは8文字以上で入力してください',
    'Password must have upper case letters': 'パスワードには大文字を含めてください',
    'Password must have lower case letters': 'パスワードには小文字を含めてください',
    'Password must have numbers': 'パスワードには数字を含めてください',
    'Password must have special characters': 'パスワードには記号を含めてください',
    'Confirmation code cannot be empty': '確認コードを入力してください',
    'Create Account': 'アカウントを作成',
    'Creating Account': 'アカウント作成中...',
    'Confirm': '確認',
    'Confirming': '確認中...',
    'Resend Code': 'コードを再送信',
    'Skip': 'スキップ',
    'Verify': '確認',
    'Verify Contact': '連絡先を確認',
  },
});

function HomeContent() {
  const { user, signOut } = useAuthenticator((context) => [context.user]);

  return (
    <div className="flex flex-col h-screen">
      {/* ヘッダー - 認証前も認証後も表示 */}
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">なんでも検索エージェント</h1>
          <p className="text-sm text-gray-600 mt-1">
            Strands AgentsがMCPサーバーを使って情報収集します!
          </p>
        </div>
        {user && (
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-gray-500">
              ログイン中: <span className="font-semibold">{user?.signInDetails?.loginId}</span>
            </p>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              サインアウト
            </button>
          </div>
        )}
      </div>

      {/* 認証ウィンドウまたはチャットインターフェース */}
      <div className="flex-1 bg-gray-50 pt-8">
        <Authenticator
          loginMechanisms={['email']}
          signUpAttributes={['email']}
          components={{
            SignUp: {
              Header() {
                return (
                  <div className="max-w-md mx-auto px-4 mb-2">
                    <p className="text-sm text-gray-700 mb-2">アカウントを作成すれば、誰でもこのアプリを利用できます。</p>
                    <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md border border-gray-200 mb-1">登録されたメールアドレスは、アプリ利用時の認証のためだけに利用されます。本アプリの開発者（みのるん）以外にメールアドレスが知られることはありません。また、宣伝などの目的外利用もされません。</p>
                    <span className="text-sm text-gray-600">アカウント作成を行うことで、上記に同意したものとみなします。</span>
                  </div>
                );
              },
            },
            SignIn: {
              Header() {
                return (
                  <div className="max-w-md mx-auto px-4 mb-2">
                    <p className="text-sm text-gray-700 mb-2">アカウントを作成すれば、誰でもこのアプリを利用できます。</p>
                    <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md border border-gray-200 mb-1">登録されたメールアドレスは、アプリ利用時の認証のためだけに利用されます。本アプリの開発者（みのるん）以外にメールアドレスが知られることはありません。また、宣伝などの目的外利用もされません。</p>
                    <span className="text-sm text-gray-600">アカウント作成を行うことで、上記に同意したものとみなします。</span>
                  </div>
                );
              },
            },
          }}
    >
      {() => (
        <ChatInterface />
      )}
    </Authenticator>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Authenticator.Provider>
      <HomeContent />
    </Authenticator.Provider>
  );
}
