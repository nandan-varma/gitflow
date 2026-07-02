import { Menu, MenuItem, Submenu, PredefinedMenuItem, CheckMenuItem } from "@tauri-apps/api/menu";
import { getCommands, runCommand, toAccelerator, setNativeMenuActive } from "./commands";
import { useRepoStore } from "../store/repoStore";
import { useUIStore } from "../store/uiStore";

function item(id: string) {
  const c = getCommands().find((x) => x.id === id);
  if (!c) throw new Error(`unknown command: ${id}`);
  return MenuItem.new({
    id,
    text: c.label,
    enabled: c.enabled,
    accelerator: c.shortcut ? toAccelerator(c.shortcut) : undefined,
    action: () => runCommand(id),
  });
}

function sep() {
  return PredefinedMenuItem.new({ item: "Separator" });
}

let buildSeq = 0;

/** Rebuilds and installs the whole macOS app menu. Cheap (menus are tiny);
 *  called from an AppShell effect whenever recents/repo/diff-mode change. */
export async function rebuildAppMenu() {
  const seq = ++buildSeq;
  const { recentRepos, openRepository } = useRepoStore.getState();
  const { diffMode } = useUIStore.getState();

  const appMenu = await Submenu.new({
    text: "GitFlow Studio",
    items: [
      await item("about"),
      await sep(),
      await item("settings"),
      await sep(),
      await PredefinedMenuItem.new({ item: "Hide" }),
      await PredefinedMenuItem.new({ item: "HideOthers" }),
      await PredefinedMenuItem.new({ item: "ShowAll" }),
      await sep(),
      await PredefinedMenuItem.new({ item: "Quit" }),
    ],
  });

  const openRecent = await Submenu.new({
    text: "Open Recent",
    enabled: recentRepos.length > 0,
    items: await Promise.all(
      recentRepos.map((path, i) =>
        MenuItem.new({
          id: `recent-${i}`,
          text: path.split("/").slice(-2).join("/"),
          action: () => openRepository(path),
        })
      )
    ),
  });

  const fileMenu = await Submenu.new({
    text: "File",
    items: [
      await item("open-repo"),
      openRecent,
      await sep(),
      await item("close-repo"),
      await sep(),
      await PredefinedMenuItem.new({ item: "CloseWindow" }),
    ],
  });

  // Required: replacing the default menu removes the default Edit menu,
  // which would break clipboard shortcuts inside the webview.
  const editMenu = await Submenu.new({
    text: "Edit",
    items: [
      await PredefinedMenuItem.new({ item: "Undo" }),
      await PredefinedMenuItem.new({ item: "Redo" }),
      await sep(),
      await PredefinedMenuItem.new({ item: "Cut" }),
      await PredefinedMenuItem.new({ item: "Copy" }),
      await PredefinedMenuItem.new({ item: "Paste" }),
      await PredefinedMenuItem.new({ item: "SelectAll" }),
    ],
  });

  const viewMenu = await Submenu.new({
    text: "View",
    items: [
      await item("command-palette"),
      await sep(),
      await item("view-graph"),
      await item("view-staging"),
      await item("view-stash"),
      await item("view-prs"),
      await sep(),
      await item("toggle-sidebar"),
      await item("toggle-command-log"),
      await item("toggle-ai"),
      await sep(),
      await CheckMenuItem.new({ id: "diff-unified", text: "Unified Diff", checked: diffMode === "unified", action: () => runCommand("diff-unified") }),
      await CheckMenuItem.new({ id: "diff-split", text: "Split Diff", checked: diffMode === "split", action: () => runCommand("diff-split") }),
      await sep(),
      await item("zoom-in"),
      await item("zoom-out"),
      await item("zoom-reset"),
    ],
  });

  const repoMenu = await Submenu.new({
    text: "Repository",
    items: [
      await item("refresh"),
      await item("fetch"),
      await item("pull"),
      await item("push"),
      await sep(),
      await item("new-branch"),
      await item("new-tag"),
      await item("stash-changes"),
      await sep(),
      await item("open-vscode"),
      await item("reveal-finder"),
      await item("open-terminal"),
    ],
  });

  const windowMenu = await Submenu.new({
    text: "Window",
    items: [
      await PredefinedMenuItem.new({ item: "Minimize" }),
      await PredefinedMenuItem.new({ item: "Maximize" }),
      await sep(),
      await PredefinedMenuItem.new({ item: "Fullscreen" }),
    ],
  });

  const menu = await Menu.new({ items: [appMenu, fileMenu, editMenu, viewMenu, repoMenu, windowMenu] });
  if (seq !== buildSeq) return; // a newer rebuild superseded this one
  await menu.setAsAppMenu();
  setNativeMenuActive();
}
