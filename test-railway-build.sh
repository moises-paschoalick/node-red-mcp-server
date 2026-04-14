#!/bin/bash
# Test the Railway Docker build locally before pushing.
# Run from the repo root: bash test-railway-build.sh

set -e

IMAGE_NAME="node-red-mcp-railway-test"

echo "Building Railway image from repo root context..."
echo "Dockerfile: Dockerfile.railway"
echo ""

docker build -f Dockerfile.railway -t "$IMAGE_NAME" . "$@"

echo ""
echo "Build succeeded."
echo ""
echo "To run and test locally:"
echo "  docker run --rm -p 1880:1880 \\"
echo "    -e OPENAI_API_KEY=your-key \\"
echo "    $IMAGE_NAME"
echo ""
echo "Then open http://localhost:1880"
