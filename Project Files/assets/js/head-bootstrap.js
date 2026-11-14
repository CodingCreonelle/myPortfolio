(function () {
    try {
        var stored = window.localStorage.getItem('portfolio-theme');
        var theme = (stored === 'light' || stored === 'dark')
            ? stored
            : ((window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark');
        document.documentElement.dataset.theme = theme;
    } catch (e) {}

    var nativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
    window.__nativeFetch = nativeFetch;

    if (window.self !== window.top) {
        try {
            window.sessionStorage.removeItem('warmup_start_time');
            window.sessionStorage.removeItem('warmup_last_reload_time');
            window.sessionStorage.removeItem('warmup_failed_sent');
            window.parent.postMessage({ type: '__aistudio_warmup_succeeded' }, '*');
        } catch (e) {}

        var earlyBootstrap = null;
        var onEarlyMessage = function (event) {
            if (event && event.data && event.data.type === 'bootstrap') {
                earlyBootstrap = event;
                try {
                    window.parent.postMessage({ type: '__aistudio_warmup_succeeded' }, '*');
                } catch (e) {}
            }
        };
        window.addEventListener('message', onEarlyMessage);

        window.addEventListener('DOMContentLoaded', function () {
            window.removeEventListener('message', onEarlyMessage);
            try {
                window.parent.postMessage({ type: '__aistudio_warmup_succeeded' }, '*');
            } catch (e) {}
            if (earlyBootstrap) {
                var ev = earlyBootstrap;
                earlyBootstrap = null;
                try {
                    window.dispatchEvent(new MessageEvent('message', {
                        data: ev.data,
                        origin: ev.origin,
                        ports: ev.ports
                    }));
                } catch (e) {}
            }
        });

        if (nativeFetch && typeof Object.defineProperty === 'function') {
            var origDefineProperty = Object.defineProperty;
            Object.defineProperty = function (obj, prop, descriptor) {
                if (obj === window && prop === 'fetch' && descriptor && typeof descriptor.get === 'function') {
                    var origGetter = descriptor.get;
                    return origDefineProperty.call(Object, obj, prop, {
                        configurable: true,
                        enumerable: true,
                        get: function () {
                            var iframeFetch = origGetter.call(this);
                            return function (resource, options) {
                                try {
                                    var urlStr = typeof resource === 'string'
                                        ? resource
                                        : (resource && typeof resource.url === 'string' ? resource.url : String(resource));
                                    var resolved = new URL(urlStr, window.location.href);
                                    if (resolved.origin === window.location.origin) {
                                        return nativeFetch(resource, options);
                                    }
                                } catch (e) {
                                    return nativeFetch(resource, options);
                                }
                                return iframeFetch.call(this, resource, options);
                            };
                        }
                    });
                }
                return origDefineProperty.apply(Object, arguments);
            };
        }
    }
})();
