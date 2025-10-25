/**
 * Chat API Route - Lambda Function URL プロキシ (IAM署名付き)
 *
 * セキュリティ強化版:
 * 1. ブラウザからこのAPI Routeを呼び出し
 * 2. このAPI RouteがSSR Compute Roleの認証情報を使用してIAM署名を生成
 * 3. IAM署名付きリクエストでLambda Function URLを呼び出し
 * 4. Lambdaからのストリーミングレスポンスをそのままブラウザに転送
 *
 * これにより、Lambda Function URLを直接公開せず、セキュアにストリーミングを実現
 */

import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { Sha256 } from '@aws-crypto/sha256-js';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, tavilyApiKey } = body;

    // 環境変数からLambda Function URLを取得
    const lambdaFunctionUrl = process.env.LAMBDA_FUNCTION_URL;
    if (!lambdaFunctionUrl) {
      return new Response(
        JSON.stringify({ error: 'LAMBDA_FUNCTION_URL environment variable is not set' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // バリデーション
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'prompt is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Lambda Function URLのリージョンを抽出 (例: https://xxx.lambda-url.us-west-2.on.aws/)
    const urlMatch = lambdaFunctionUrl.match(/lambda-url\.([^.]+)\.on\.aws/);
    const region = urlMatch ? urlMatch[1] : 'us-west-2';

    console.log('[API Route] Lambda Function URL:', lambdaFunctionUrl);
    console.log('[API Route] Region:', region);

    // AWS認証情報を取得 (Amplify HostingのSSR Compute Roleから自動取得)
    const credentialsProvider = fromNodeProviderChain();
    const credentials = await credentialsProvider();

    console.log('[API Route] Credentials obtained:', {
      accessKeyId: credentials.accessKeyId.substring(0, 10) + '...',
    });

    // リクエストボディをJSON文字列化
    const requestBody = JSON.stringify(body);

    // Lambda Function URLのパースされたURL
    const url = new URL(lambdaFunctionUrl);

    // AWS Signature V4 署名を生成
    const signer = new SignatureV4({
      credentials,
      region,
      service: 'lambda',
      sha256: Sha256,
    });

    // HttpRequestオブジェクトを作成
    const httpRequest = new HttpRequest({
      method: 'POST',
      protocol: url.protocol,
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        host: url.hostname,
      },
      body: requestBody,
    });

    // IAM署名を追加
    const signedRequest = await signer.sign(httpRequest);

    console.log('[API Route] Signed request headers:', Object.keys(signedRequest.headers));

    // Lambda Function URLを呼び出し
    const lambdaResponse = await fetch(lambdaFunctionUrl, {
      method: 'POST',
      headers: signedRequest.headers as Record<string, string>,
      body: requestBody,
    });

    console.log('[API Route] Lambda response status:', lambdaResponse.status);
    console.log('[API Route] Lambda response headers:', Object.fromEntries(lambdaResponse.headers.entries()));

    if (!lambdaResponse.ok) {
      const errorText = await lambdaResponse.text();
      console.error('[API Route] Lambda error response:', errorText);
      return new Response(
        JSON.stringify({
          error: 'Failed to invoke Lambda Function URL',
          status: lambdaResponse.status,
          details: errorText
        }),
        { status: lambdaResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Lambdaからのストリーミングレスポンスをそのままブラウザに転送
    // ReadableStreamをそのままパススルー (バッファリングなし)
    return new Response(lambdaResponse.body, {
      status: lambdaResponse.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[API Route] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
