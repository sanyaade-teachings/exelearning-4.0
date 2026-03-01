# WebMCP Integration (Developer Guide)

This page documents the initial WebMCP integration in eXeLearning.

## Goal

Expose safe MCP tools from the browser so AI agents can operate eXeLearning without a separate MCP server process.

## Design decisions

- Use a single implementation path for **online** and **static** modes.
- Execute tool actions against **YjsProjectBridge** and **YjsStructureBinding**.
- Keep REST API out of the MCP execution path for this first iteration.
- Add UI entry point at **Help → Connect MCP**.
- Prefer native browser WebMCP (`navigator.modelContext`) when available.
- Keep `webmcp.js` as fallback with configurable script sources and retry from UI.

## Main files

- `public/app/integrations/webmcp/WebMCPService.js`
- `public/app/app.js`
- `views/workarea/menus/menuNavbar.njk`
- `views/workarea/menus/menuHeadTop.njk`
- `public/app/workarea/menus/menuEngine.js`
- `public/app/workarea/menus/navbar/items/navbarHelp.js`
- `views/workarea/modals/pages/connectmcp.njk`
- `public/app/workarea/modals/modals/pages/modalConnectMcp.js`
- `public/app/workarea/modals/modalsManager.js`

## Tool model

### Read tool

- `exe.context.current`
- `exe.project.get_metadata`
- `exe.idevices.icons.list`
- `exe.assets.list`

### Write tools

- `exe.project.ensure_metadata`
- `exe.pages.create`
- `exe.pages.move`
- `exe.pages.delete`
- `exe.blocks.create`
- `exe.blocks.move`
- `exe.components.create`
- `exe.idevices.text.add`
- `exe.idevices.az_quiz_game.add`
- `exe.idevices.image_gallery.add`
- `exe.idevices.form.add`
- `exe.idevices.text.set_rich_html`
- `exe.idevices.text.append_rich_html`
- `exe.idevices.text.insert_image_base64`
- `exe.idevices.text.insert_image_url`
- `exe.idevices.text.insert_image_asset`
- `exe.components.set_html`
- `exe.components.delete`
- `exe.assets.upload_base64`
- `exe.assets.upload_data_url`
- `exe.assets.import_image_url`
- `exe.project.save`

Write tools can require confirmation depending on policy (default: one confirmation per session).

`exe.idevices.text.add` now enforces:

- Required project metadata completeness (`title`, `author`, `description`).
- Required block title (`blockName`) for the text box.
- Optional `iconName` validated against current theme icons.

`exe.idevices.az_quiz_game.add` follows the same block/metadata contract and receives
an `entries` array (word/definition + optional media/mode fields) to generate a ready-to-edit rosco.

`exe.idevices.image_gallery.add` creates JSON payloads compatible with `image-gallery` (`img_0`, `img_1`, ...)
and accepts external URLs or generated `picsum.photos` URLs from seeds.

`exe.idevices.form.add` creates JSON payloads for `form` including `questionsData` and core options
(instructions, randomization, timer, SCORM, evaluation).

To make adding new iDevices simpler, WebMCPService now uses reusable helpers:

- `prepareIdeviceTarget(args)` for page/block/icon resolution.
- `buildComponentInitialData(args)` for consistent `htmlContent`/`htmlView`/`jsonProperties` payload creation.

`exe.pages.create` now reuses the initial blank page (`New page` / `Nueva página`) when possible by renaming it instead of creating an extra root page.

Write confirmation policy is configurable through `eXeLearning.config.webmcpWriteConfirmationPolicy`:

- `session` (default, one prompt per browser session)
- `per_action`
- `none`

## UI flow

1. User opens **Help → Connect MCP**.
2. Modal displays MCP client config snippet and starts WebMCP autoload.
3. User can retry with **Load WebMCP script**.
4. User copies snippet and configures MCP client.
5. User opens WebMCP widget and pastes token.
6. Agent can call registered tools.

## Initial implementation checklist

- [x] Add Help menu entry (`Connect MCP`) desktop + mobile.
- [x] Add `Connect MCP` modal with steps and status.
- [x] Create WebMCP integration service.
- [x] Register initial Yjs-based tools.
- [x] Add Text iDevice creation tool.
- [x] Wire service initialization in app bootstrap.
- [x] Add/adjust frontend unit tests for modified navbar/modal manager.
- [x] Add end-user and developer documentation.

## Next steps

- Add optional server-side audit trail for MCP actions.
- Add per-tool policy settings (allow/deny by role).
- Add richer resource tools (selected node content, project snapshot).
- Add integration tests for MCP tool execution paths.
- Vendor `webmcp.js` under `public/libs/webmcp/` to avoid external fallback dependency.
