## Processes in Browser

### Basic Concept of Process

A single execution of a program that occupies a unique memory space. It's the **basic unit** of operating system execution. When a program is launched, the operating system creates a block of memory for the program to store code, running data, and a main thread that executes tasks. We call such a running environment a process.

### Characteristics of Process

- At least one running thread in a process: the main thread, which is automatically created when the process starts
- Multiple threads can run simultaneously in a process; we say the program is multi-threaded
- Data within a process can be directly shared among its multiple threads, but data between multiple processes cannot be directly shared
- Processes are isolated from each other (different processes communicate through IPC)

### Browser Process Representation

- Browser Main Process
  The main process of the browser, responsible for displaying the browser interface and managing various pages. It's the ancestor of all other types of processes in the browser, responsible for the creation and destruction of other processes. **There is one and only one!!!!!**
- Renderer Process
  - Web page rendering process, responsible for page rendering. There can be multiple renderer processes, though the number of renderer processes is not necessarily equal to the number of web pages you have open
  - Runs in a sandbox; cannot read or write to the hard disk; cannot obtain operating system permissions
  - Parsing, rendering, JS execution
- Various Plugin Processes
- GPU Process
  Browsers on mobile devices may be different:
  - Android doesn't support plugins, so there's no plugin process
  - GPU has evolved into a thread of the Browser process
  - Renderer process has evolved into a service process of the operating system, but it remains independent
