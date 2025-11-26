## Reflow (Reflowing)

Reflow is when layout or geometric properties need to change. Reflow is a key factor affecting browser performance because its changes involve layout updates of part of the page (or the entire page). A reflow of one element may cause reflow of all its child elements, as well as subsequent nodes and ancestor node elements in the DOM.

### Triggering Reflow

- Adding or removing visible DOM elements
- Element position changes
- Element size changes (including margins, padding, border size, height and width, etc.)
- Content changes, such as text changes or an image being replaced by another image of different size
- Initial page rendering (this is definitely unavoidable)
- Browser window size changes (because reflow calculates element position and size based on viewport size)

### Cost of Reflow

The browser triggers a re-layout and a series of subsequent sub-stages. This process is called **reflow**. Undoubtedly, **reflow requires updating the complete rendering pipeline, so it has the highest cost**
