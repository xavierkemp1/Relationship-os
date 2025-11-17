# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Linux prerequisites

When building the Tauri shell on Linux you need the GTK/WebKit stack plus the
development headers for `glib`. On Debian/Ubuntu images you can install
everything the project needs with:

```bash
sudo apt-get update
sudo apt-get install -y libgtk-3-dev
```

The `libgtk-3-dev` meta-package will pull in all the transitive packages (GL,
Wayland/X11, Pango, Harfbuzz, etc.) required by `wry` so `pnpm tauri dev` and
`pnpm tauri build` can compile successfully.
