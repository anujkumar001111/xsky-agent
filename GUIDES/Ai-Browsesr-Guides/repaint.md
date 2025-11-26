## Repaint

Updating an element's paint properties without affecting layout is called repaint, such as `outline`, `visibility`, `color`, `background-color`, etc. The cost of repaint is high because the browser must verify the visibility of other node elements in the DOM tree.

- Element's background color
