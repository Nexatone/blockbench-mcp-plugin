# Blockbench native APIs (5.1.6)

Use requireNativeModule(name) for native modules in plugin code. It is provided in the plugin scope, not on globalThis. Respect permission denial and keep native I/O explicit.

Safe modules include path, crypto, events, zlib, timers, url, buffer, stream and perf_hooks. Permission-requestable modules include fs, process, child_process, https, net, tls, util, os, v8, dialog, clipboard and shell. The http, electron and worker_threads modules are unsupported through this API in 5.1.6. Do not bypass this restriction through internal require mechanisms.

For a supported permission-requestable module, show_permission_dialog:false avoids prompting and may return undefined. Unsupported module names throw. Handle denial before accessing a file. Check the native API contract when supporting another Blockbench version.

Prefer export_model for model output and typed modeling tools for edits. Dependencies must run inside Blockbench's plugin environment rather than assume a standalone Node.js process.
