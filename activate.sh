#!/bin/bash
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Activating Meeting Intelligence Assistant environment..."

# Activate Python venv
if [ -f "$PROJECT_DIR/venv/bin/activate" ]; then
    source "$PROJECT_DIR/venv/bin/activate"
    echo "✓ Python venv activated"
fi

# Activate Node environment
if [ -f "$PROJECT_DIR/node_env/bin/activate" ]; then
    source "$PROJECT_DIR/node_env/bin/activate"
    echo "✓ Node.js environment activated"
elif [ -f "$PROJECT_DIR/.nvmrc" ] && command -v nvm &> /dev/null; then
    nvm use
    echo "✓ Node.js version set via nvm"
elif [ -d "$PROJECT_DIR/.local/node" ]; then
    export PATH="$PROJECT_DIR/.local/node/bin:$PATH"
    echo "✓ Portable Node.js activated"
fi

# Set Python path for node-gyp
export PYTHON="$PROJECT_DIR/venv/bin/python"
export npm_config_python="$PROJECT_DIR/venv/bin/python"

echo ""
echo "Environment ready! Node: $(node -v), Python: $(python --version)"
echo "Run 'npm run dev' to start development"
