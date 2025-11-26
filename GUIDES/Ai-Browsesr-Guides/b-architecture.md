## Chrome's Latest Browser Architecture

- 1 Browser main process
  - Interface display
  - User interaction
  - Child process management
  - Provides storage
- 1 GPU process
  - 3D CSS rendering
- 1 Network process
  - Network resource loading
  - Provides network downloads for rendering process and browser process, etc.
- Multiple renderer processes
  - Convert HTML+CSS+JS into interactive web pages
  - Layout engine: Blink
  - JavaScript engine: V8
- Multiple plugin processes
  - Mainly responsible for running plugins

![20200407221502](https://raw.githubusercontent.com/yayxs/Pics/master/img/20200407221502.png)
