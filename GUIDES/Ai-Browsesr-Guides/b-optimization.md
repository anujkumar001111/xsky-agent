#### (3). Browser Optimization

Most modern browsers use a queue mechanism to batch update layouts. The browser will put modification operations in a queue, and it will clear the queue at least once per browser refresh (i.e., 16.6ms). However, when you **get layout information, there may be operations in the queue that affect the return values of these properties or methods. Even if there aren't any, the browser will still force the queue to clear, triggering reflow and repaint to ensure the correct value is returned**.

This mainly includes the following properties or methods:

- `offsetTop`, `offsetLeft`, `offsetWidth`, `offsetHeight`
- `scrollTop`, `scrollLeft`, `scrollWidth`, `scrollHeight`
- `clientTop`, `clientLeft`, `clientWidth`, `clientHeight`
- `width`, `height`
- `getComputedStyle()`
- `getBoundingClientRect()`

## Minimize the Cost of Repaint and Reflow as Much as Possible

### From a Styling Perspective

- **Use `transform` instead of `top`**

- **Use `visibility` instead of `display: none`**, because the former only causes repaint, while the latter causes reflow (changes the layout)

- **Avoid using `table` layout**, as even a small change may cause the entire `table` to re-layout.

- **Change `class` at the deepest end of the `DOM` tree as much as possible**. Reflow is unavoidable, but you can reduce its impact. Changing class at the deepest end of the DOM tree as much as possible can limit the scope of reflow, minimizing the number of affected nodes.

- **Avoid setting multiple layers of inline styles**. CSS selectors match and search **from right to left**, so avoid too many node levels.

  ```
  <div>
    <a> <span></span> </a>
  </div>
  <style>
    span {
      color: red;
    }
    div > a > span {
      color: red;
    }
  </style>
  ```

  For the first way of setting styles, the browser only needs to find all the `span` tags on the page and set the color. But for the second way of setting styles, the browser first needs to find all the `span` tags, then find the `a` tag on the `span` tag, and finally find the `div` tag, and then set the color for `span` tags that meet these conditions. This recursive process is very complex. So we should try to avoid writing **overly specific** CSS selectors, and for HTML, try to add as few meaningless tags as possible to ensure **flat hierarchy**.

- **Apply animation effects to elements with `position` property set to `absolute` or `fixed`**, avoiding affecting the layout of other elements. This only causes repaint instead of reflow. At the same time, controlling animation speed can use `requestAnimationFrame`, see [Discussion on requestAnimationFrame](https://github.com/LuNaHaiJiao/blog/issues/30) for details.

- **Avoid using `CSS` expressions**, as they may trigger reflow.

- **Set frequently repainted or reflowed nodes as layers**. Layers can prevent the rendering behavior of that node from affecting other nodes. For example, tags like `will-change`, `video`, `iframe`, etc., the browser will automatically turn such nodes into layers.

- **CSS3 hardware acceleration (GPU acceleration)**. Using CSS3 hardware acceleration, animations like `transform`, `opacity`, `filters` won't cause reflow and repaint. However, for other properties of animations, such as `background-color`, they will still cause reflow and repaint, but it can still improve the performance of these animations.

### From a Scripting Perspective

- **Avoid frequent style operations**. It's best to rewrite the `style` property at once, or define the style list as a `class` and change the `class` property all at once.
- **Avoid frequent `DOM` operations**. Create a `documentFragment`, apply all `DOM operations` on it, and finally add it to the document.
- **Avoid frequently reading properties that trigger reflow/repaint**. If you really need to use them multiple times, cache them in a variable.
- **Use absolute positioning for elements with complex animations**, making them out of the document flow, otherwise it will cause frequent reflows of parent and subsequent elements.
