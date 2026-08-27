# dsh-flow-canvas Installation Guide

## Quick Install

### Windows
```batch
install.bat
```

### Linux/macOS
```bash
chmod +x install.sh
./install.sh
```

## Manual Installation

### Step 1: Add Plugin to DSH

```bash
cd ~/.dsh/profiles
dsh plugin --profile desktop add /path/to/dsh-flow-canvas
```

### Step 2: Enable Plugin

Edit `~/.dsh/profiles/desktop/cordis.patch.yml`:

```yaml
- insert:
    - id: flow-canvas
      name: 'dsh-flow-canvas'
      config:
        enabled: true
```

### Step 3: Verify Installation

```bash
dsh --profile desktop --dump-config | grep flow-canvas
```

You should see:
```
# == dsh-flow-canvas
- id: flow-canvas
  name: dsh-flow-canvas
  config:
    enabled: true
```

## Start DSH

```bash
dsh --profile desktop
```

## Use the Plugin

1. In DSH, use the `flow_canvas` tool
2. The visual workflow editor will open
3. Drag and drop nodes to create workflows
4. Connect nodes by dragging between handles
5. Click "Run" to execute the workflow

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save workflow |
| `Ctrl+E` | Export workflow |
| `Ctrl+D` | Duplicate node |
| `Ctrl+G` | Auto layout |
| `Ctrl+1` | Fit view |
| `Ctrl+0` | Reset zoom |
| `Delete` | Delete selected |
| `Escape` | Deselect all |

## Uninstall

### Windows
```batch
uninstall.bat
```

### Manual Uninstall

```bash
cd ~/.dsh/profiles
dsh plugin --profile desktop remove dsh-flow-canvas
```

Then reset `desktop/cordis.patch.yml`:
```yaml
[]
```
