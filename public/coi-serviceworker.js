/*! coi-serviceworker v0.1.7 - Guido Zuidhof & Godot Engine Community, licensed under MIT */
let coepCredentialless = true;
if (typeof window === "undefined") {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (event) => {
        if (event.data && event.data.type === "deregister") {
            self.registration.unregister().then(() => {
                return self.clients.matchAll();
            }).then((clients) => {
                clients.forEach((client) => client.navigate(client.url));
            });
        }
    });

    self.addEventListener("fetch", function (event) {
        const request = event.request;
        if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(request).then((response) => {
                if (response.status === 0) {
                    return response;
                }

                const newHeaders = new Headers(response.headers);
                newHeaders.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
                newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            }).catch((e) => console.error(e))
        );
    });
} else {
    (() => {
        const reloadedByCOI = window.sessionStorage.getItem("coiReloadedBySelf");
        window.sessionStorage.removeItem("coiReloadedBySelf");
        const coi = {
            shouldRegister: () => true,
            shouldDeregister: () => false,
            doCoep: () => true,
            coepCredentialless: () => true,
            quiet: false,
            ...window.coi
        };

        const n = navigator;
        if (n.serviceWorker && coi.shouldRegister()) {
            n.serviceWorker.register("/coi-serviceworker.js").then((registration) => {
                if (coi.doCoep() && !window.crossOriginIsolated && !reloadedByCOI) {
                    window.sessionStorage.setItem("coiReloadedBySelf", "true");
                    window.location.reload();
                }
            }, (e) => {
                !coi.quiet && console.warn("COI Service Worker registration note:", e);
            });
        }
    })();
}
