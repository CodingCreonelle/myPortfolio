(function () {
    'use strict';

    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
        return;
    }

    if (window.location.protocol === 'file:') {
        return;
    }

    var host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
        return;
    }

    try {
        var source = new EventSource('/__livereload');
        source.addEventListener('message', function (event) {
            if (event.data && event.data.trim() === 'reload') {
                window.location.reload();
            }
        });

        source.addEventListener('error', function () {
            // The dev server is gone: stop reconnecting instead of retrying forever.
            source.close();
        });
    } catch (error) {
        console.warn('Live reload not available:', error);
    }
})();
