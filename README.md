# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Platform prerequisites

### Windows (recommended during development)

1. Install the **Visual Studio 2022 Build Tools** with the *Desktop development
   with C++* workload plus the latest Windows SDK (the `winget` command below
   includes everything Tauri needs):

   ```powershell
   winget install --id Microsoft.VisualStudio.2022.BuildTools --source winget \
     --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
   ```

2. Install the evergreen **WebView2 runtime** so Tauri’s webview boots without
   pulling in Edge/Chromium at runtime:

   ```powershell
   winget install --id Microsoft.EdgeWebView2Runtime --source winget
   ```

3. Install [Rustup](https://rustup.rs/) (or `winget install --id Rustlang.Rustup`)
   and [Node.js 20+](https://nodejs.org/) with [pnpm](https://pnpm.io/installation).

4. From the repository root run the usual dev workflow:

   ```powershell
   pnpm install
   pnpm tauri dev
   ```

### Linux

When building the Tauri shell on Linux you still need the GTK/WebKit stack plus
the development headers for `glib`. On Debian/Ubuntu images you can install
everything the project needs with:

```bash
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libsoup-3.0-dev libwebkit2gtk-4.1-dev
```

`libgtk-3-dev` brings in GTK/WebKit’s rendering stack while the `libsoup` and
`libwebkit2gtk` development headers satisfy the newer `wry` requirements so
`pnpm tauri dev` and `pnpm tauri build` can compile successfully.
