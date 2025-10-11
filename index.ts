/**
 * Bun Development Server
 * Serves static files and libraries
 */

const server = Bun.serve({
  port: 3000,
  development: true,

  async fetch(req) {
    const path = new URL(req.url).pathname;

    if (path === "/" || path === "/index.html") {
      return new Response(Bun.file("./public/index.html"), {
        headers: { "Content-Type": "text/html" }
      });
    }

    if (path.startsWith("/src/") && path.endsWith(".js")) {
      return new Response(Bun.file(`./public${path}`), {
        headers: { "Content-Type": "application/javascript" }
      });
    }

    if (path === "/matter.min.js") {
      return new Response(Bun.file("./node_modules/matter-js/build/matter.min.js"), {
        headers: { "Content-Type": "application/javascript" }
      });
    }

    if (path === "/Tone.js") {
      return new Response(Bun.file("./node_modules/tone/build/Tone.js"), {
        headers: { "Content-Type": "application/javascript" }
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🎵 Music Bounce running at http://localhost:${server.port}`);