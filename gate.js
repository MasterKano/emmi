/* EMMi sign-in now happens on the server (functions/_middleware.js, Cloudflare Pages Function, since 20 Nov 2026,
   Jerry t1448: password only). This old in-page password screen is retired so nobody is asked twice; the file stays
   because every page loads it (scripts/site_files.sh) and old cached pages may still ask for it. */
(function () { try { document.documentElement.classList.remove("emma-locked"); } catch (e) { /* nothing to undo */ } })();
