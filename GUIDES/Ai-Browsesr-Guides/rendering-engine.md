## Browser Rendering Engine

#### (1). Main Modules

- Parser
  - Parser that interprets HTML documents
  - Purpose: Interpret HTML text into a DOM tree
- CSS Parser

  - Its purpose is to calculate style information for each element object in the DOM
  - Provides infrastructure for layout

- JavaScript Engine
  - JavaScript code can modify web page content and CSS information
  - The JavaScript engine can interpret JavaScript code and modify web page content and style information through DOM interfaces and CSS tree interfaces, thereby changing rendering results
- Layout (Reflow)
  - After the DOM is created, Webkit needs to combine element objects with style information
  - Calculate their size, position, and other layout information
  - Form an internal representation model that can express all this information
- Drawing Module
  - Use graphics libraries to draw each node of the web page into image results after layout calculation

## Rendering Engine Processing Flow

[Render Tree Construction, Layout, and Painting - Chinese](https://developers.google.com/web/fundamentals/performance/critical-rendering-path/render-tree-construction?hl=zh-cn)

![20200407223600](https://raw.githubusercontent.com/yayxs/Pics/master/img/20200407223600.png)

1.  When HTML tags are encountered, the HTML parser is called to parse them into corresponding tokens (a token is a serialized sequence of tag text) and build the DOM tree (a block of memory that stores tokens and establishes relationships between them)
2.  When `style/link` tags are encountered, the parser is called to process CSS tags and build the CSS style tree, i.e., CSSOM
3.  When `script` tags are encountered, the `JavaScript` parser is called to process `script` tags, bind events, modify DOM tree/CSS tree, etc.
4.  Merge the `DOM` tree and `CSS` tree into a render tree (render tree: pseudo-elements like :after and :before will be built into the DOM tree at this stage)
5.  Render according to the render tree to calculate the geometric information of each node (this process depends on graphics libraries)
6.  **Page Painting**: Convert each page layer to pixels, decode media files. Draw each node to the screen.
