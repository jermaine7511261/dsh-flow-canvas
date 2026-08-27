#!/bin/bash
# Install dsh-flow-canvas plugin to DSH

set -e

echo "Installing dsh-flow-canvas plugin..."

# DSH profiles directory
DSH_PROFILES_DIR="$HOME/.dsh/profiles"

# Check if DSH is installed
if [ ! -d "$DSH_PROFILES_DIR" ]; then
    echo "Error: DSH profiles directory not found at $DSH_PROFILES_DIR"
    echo "Please install DSH first: npm install -g @deepseek-ai/dsh"
    exit 1
fi

# Get plugin directory
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"

# Add plugin to desktop profile
echo "Adding plugin to desktop profile..."
cd "$DSH_PROFILES_DIR"
dsh plugin --profile desktop add "$PLUGIN_DIR"

# Update cordis.patch.yml to enable the plugin
PATCH_FILE="$DSH_PROFILES_DIR/desktop/cordis.patch.yml"

# Check if patch file already has flow-canvas entry
if grep -q "flow-canvas" "$PATCH_FILE" 2>/dev/null; then
    echo "Plugin already enabled in cordis.patch.yml"
else
    echo "Enabling plugin in cordis.patch.yml..."
    cat > "$PATCH_FILE" << 'EOF'
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; `!!js` expressions allowed).
- insert:
    - id: flow-canvas
      name: 'dsh-flow-canvas'
      config:
        enabled: true
EOF
fi

echo ""
echo "✅ dsh-flow-canvas plugin installed successfully!"
echo ""
echo "To use the plugin:"
echo "  1. Start DSH: dsh --profile desktop"
echo "  2. Use the flow_canvas tool to open the visual editor"
echo ""
echo "Keyboard shortcuts:"
echo "  Ctrl+S      - Save workflow"
echo "  Ctrl+E      - Export workflow"
echo "  Ctrl+D      - Duplicate node"
echo "  Ctrl+G      - Auto layout"
echo "  Ctrl+1      - Fit view"
echo "  Delete      - Delete selected"
echo ""
