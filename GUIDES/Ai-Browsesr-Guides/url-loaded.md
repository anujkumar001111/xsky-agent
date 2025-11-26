## What Happens from Entering a `URL` to Page Load Completion?

As shown in the figure below, what happens when you enter an address in the browser address bar?

![20200407214919](https://raw.githubusercontent.com/yayxs/Pics/master/img/20200407214919.png)

### `Navigation` Process

- Browser process receives user input URL request
  - Browser process forwards the URL to the network process
- Real URL request is initiated in the network process
- Network process receives response header data
  - Parses response header data
  - Forwards data to browser process
- Browser receives response header from network process, sends commit navigation message to renderer process
- Renderer process receives message, then prepares HTML data. The way to receive data is by establishing a data pipeline directly with the network process
- Renderer process confirms submission to browser process
- Browser process receives message from renderer process, removes old document, then updates state in browser process

### Page Display

1. User Input

- Determine whether the address bar contains search content or a requested URL
  - If it's search content, it's a search keyword
  - If it conforms to URL rules, compose a complete URL

2. URL Request Process

- First, the network process checks whether the resource is cached locally

  - If cached, directly returns the resource to the browser process
  - If not found in cache, directly enters the network request process

- The first step before the request is DNS resolution, then obtain the server IP address of the requested domain. If it's HTTPS, TLS connection also needs to be established

- Establish `TCP` connection with the server using the IP address

- Browser side constructs request line, request header information, attaches Cookie and other data related to the domain to the request header, then sends the constructed request information to the server
- Server receives request information, generates response data (response line, response header, response body) based on the request information
- Network process parses the content of the response header
- Redirect
  - After receiving the server's response header, the network process starts parsing the response header
    - 301/302 redirect to another URL **there is an address in the Location field**
- Response Data Processing
  - `Content-Type`: Tells the browser what type of data the server returns in the response body

3. Prepare Renderer Process

By default, Chrome allocates a renderer process for each page, though multiple pages may run in the same renderer process.

- Chrome's default strategy is that each tab corresponds to a renderer process. If a new page is opened from one page and the new page belongs to the same site as the current page, the new page will reuse the parent page's renderer process
- Renderer process strategy:
  - Normally, opening a new page will use a separate process
  - If A and B belong to the same site, then page B reuses page A's renderer process. In other cases, the browser process will create a new renderer process for B

4. Commit Document

Browser process submits the HTML data received by the network process to the renderer process

5. Rendering Stage

- Once the document is submitted, the renderer process begins parsing and loading sub-resources
