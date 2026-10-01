(function () {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
        return;
    }

    if (window.location.protocol === 'file:') {
        return;
    }

    try {
        var source = new EventSource('/__livereload');
        source.addEventListener('message', function (event) {
            if (event.data && event.data.trim() === 'reload') {
                window.location.reload(true);
            }
        });

        source.addEventListener('error', function () {
            // Keep the connection alive if the server is not available.
        });
    } catch (error) {
        console.warn('Live reload not available:', error);
    }
})();
