## Browser Rendering Process

- The browser (rendering process) parses `HTML` into `DOM` (DOM tree structure),
- The browser (rendering process) converts `CSS styles` into `styleSheets`, calculates DOM styles
- Creates layout tree, calculates element layout information
- Divides layout tree into layers, generates layer tree
- Creates paint list for layers, submits to compositor thread
- Compositor thread divides layers into **tiles**, and converts tiles into bitmaps in the **rasterization thread pool**.
- Compositor thread sends **DrawQuad** draw tile commands to the browser process.
- Browser process generates the page based on DrawQuad messages and **displays** it on the monitor.
