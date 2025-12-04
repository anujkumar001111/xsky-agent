export function extract_related_files() {
    function extractRelatedFiles() {
        const files: any = {
            images: [],
            videos: [],
            audio: [],
            icons: []
        };

        // Images
        document.querySelectorAll('img').forEach((img: any) => {
            files.images.push({
                src: img.currentSrc || img.src,
                alt: img.alt,
                width: img.naturalWidth,
                height: img.naturalHeight,
                isVisible: img.offsetParent !== null
            });
        });

        // Videos
        document.querySelectorAll('video').forEach((video: any) => {
            files.videos.push({
                src: video.currentSrc || video.src,
                poster: video.poster,
                duration: video.duration,
                paused: video.paused
            });
        });

        // Audio
        document.querySelectorAll('audio').forEach((audio: any) => {
            files.audio.push({
                src: audio.currentSrc || audio.src,
                duration: audio.duration,
                paused: audio.paused
            });
        });

        // Icons
        document.querySelectorAll('link[rel*="icon"]').forEach((link: any) => {
            files.icons.push({
                href: link.href,
                type: link.type,
                sizes: link.sizes ? link.sizes.value : null
            });
        });

        return files;
    }

    return extractRelatedFiles();
}
