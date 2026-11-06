/**
 * Cloudflare Pages Functions: Health Check Endpoint
 * Route: /api/health
 */
export async function onRequestGet() {
    return new Response(
        JSON.stringify({
            status: 'ok',
            app: 'HitFit',
            platform: 'Cloudflare Pages',
            domain: 'hitfit.zainaxes.com',
            timestamp: new Date().toISOString(),
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
            },
        }
    );
}
