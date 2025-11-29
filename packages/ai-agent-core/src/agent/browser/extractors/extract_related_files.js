// extract_related_files.js
// Extracts media assets (images, videos, audio, icons)

(function() {
    function extractRelatedFiles() {
        const files = {
            images: [],
            videos: [],
            audio: [],
            icons: []
        };

        // Images
        document.querySelectorAll('img').forEach(img => {
            files.images.push({
                src: img.currentSrc || img.src,
                alt: img.alt,
                width: img.naturalWidth,
                height: img.naturalHeight,
                isVisible: img.offsetParent !== null
            });
        });

        // Videos
        document.querySelectorAll('video').forEach(video => {
             files.videos.push({
                 src: video.currentSrc || video.src,
                 poster: video.poster,
                 duration: video.duration,
                 paused: video.paused
             });
        });

        // Audio
        document.querySelectorAll('audio').forEach(audio => {
            files.audio.push({
                src: audio.currentSrc || audio.src,
                duration: audio.duration,
                paused: audio.paused
            });
        });

        // Icons (favicons)
        document.querySelectorAll('link[rel*="icon"]').forEach(link => {
            files.icons.push({
                href: link.href,
                type: link.type,
                sizes: link.sizes ? link.sizes.value : null
            });
        });

        return files;
    }
    return extractRelatedFiles();
})();
