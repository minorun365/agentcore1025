/**
 * Environment Check API Route
 *
 * 環境変数にTavily APIキーが設定されているかチェックします。
 * これにより、フロントエンドで条件付きレンダリングを行えます。
 */

export async function GET() {
  return Response.json({
    hasTavilyKey: !!process.env.TAVILY_API_KEY
  });
}
