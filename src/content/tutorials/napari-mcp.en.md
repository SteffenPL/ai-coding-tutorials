---
title: "Napari MCP: Control napari with AI"
tags: [python, napari, image-analysis, MCP, beginner]
updated: "2026-04"
duration: 15
hasVideo: true
videoUrl: videos/napari-mcp.mp4
thumbnail: images/napari-mcp-thumb.png
githubUrl: https://github.com/ashbi-kyoto/napari-mcp
links:
  - label: napari Documentation
    url: https://napari.org/stable/
  - label: MCP Specification
    url: https://modelcontextprotocol.io
---

## What is Napari MCP?

Napari MCP connects the [napari](https://napari.org) image viewer to AI assistants via the **Model Context Protocol (MCP)**. This lets you control napari — loading images, adjusting layers, running segmentation — through natural language prompts in tools like Claude Code or ChatGPT.

Instead of writing boilerplate Python to open files and tweak visualization parameters, you simply describe what you want:

:::prompt
Open the file `cells.tif`, apply a Gaussian blur with sigma=2, and then run Otsu thresholding to segment the cells. Show the segmentation as a labels layer on top of the original image.
:::

## Getting Started

### Prerequisites

- Python 3.10+
- A working napari installation
- An MCP-compatible AI client (e.g., Claude Code)

### Installation

```bash
# Install napari-mcp from PyPI
pip install napari-mcp

# Or install from source
git clone https://github.com/ashbi-kyoto/napari-mcp.git
cd napari-mcp
pip install -e .
```

### Starting the MCP Server

Launch napari with the MCP server enabled:

```bash
napari --with mcp
```

Or start programmatically:

```python
import napari
from napari_mcp import start_mcp_server

viewer = napari.Viewer()
start_mcp_server(viewer, port=8765)

napari.run()
```

## Connecting Your AI Client

### Claude Code

Add the MCP server to your Claude Code configuration:

```json
{
  "mcpServers": {
    "napari": {
      "command": "napari-mcp",
      "args": ["--port", "8765"]
    }
  }
}
```

Once connected, you can interact with napari directly from your AI conversation.

## Example Workflows

### Loading and Visualizing Data

:::prompt
Load the image stack at `~/data/embryo_timelapse.tif`. Set the colormap to `magma` and adjust the contrast limits so the dim structures are visible.
:::

### Running Segmentation

:::prompt
Take the current image layer and segment the nuclei using the following steps:
1. Apply a median filter (size=3) to reduce noise
2. Use Otsu thresholding to create a binary mask
3. Apply watershed segmentation to separate touching nuclei
4. Add the result as a labels layer called "nuclei_segmentation"
:::

### Batch Processing

```python
# You can also script napari-mcp operations directly
from napari_mcp import NapariClient

client = NapariClient()

# List all layers
layers = client.list_layers()
print(f"Current layers: {[l.name for l in layers]}")

# Add a new image
client.add_image("path/to/image.tif", name="my_image")

# Take a screenshot
client.screenshot("output.png")
```

## Available MCP Tools

The napari MCP server exposes these tools to the AI client:

- **`init_viewer`** — Open a new napari viewer
- **`add_layer`** — Load an image, labels, points, or shapes layer
- **`list_layers`** — List all current layers and their properties
- **`set_layer_properties`** — Adjust colormap, opacity, contrast limits, etc.
- **`execute_code`** — Run arbitrary Python code in the napari context
- **`screenshot`** — Capture the current viewer as an image
- **`apply_to_layers`** — Apply filters or transforms to existing layers

## Next Steps

- Explore the [napari plugin ecosystem](https://napari-hub.org) for specialized analysis tools
- Read the [MCP specification](https://modelcontextprotocol.io) to understand how AI-tool integration works
- Try building your own MCP tools for custom analysis pipelines
