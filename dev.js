// Static dev server for ./public. Production serves the same folder as-is.
const server = Bun.serve({
    port: 3000,
    async fetch(req) {
        const path = new URL(req.url).pathname;
        const file = Bun.file(`./public${path.endsWith('/') ? `${path}index.html` : path}`);
        return (await file.exists()) ? new Response(file) : new Response('Not found', { status: 404 });
    },
});

console.log(`Bounce Beats: http://localhost:${server.port}`);
