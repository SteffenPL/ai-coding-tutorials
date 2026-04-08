---
title: "Napari MCP: AIでnapariを操作する"
links:
  - label: napari ドキュメント
    url: https://napari.org/stable/
  - label: MCP 仕様書
    url: https://modelcontextprotocol.io
---

## Napari MCPとは？

Napari MCPは、[napari](https://napari.org)画像ビューアを**Model Context Protocol（MCP）**を介してAIアシスタントに接続します。これにより、Claude CodeやChatGPTなどのツールで自然言語プロンプトを通じて、napariの操作（画像の読み込み、レイヤーの調整、セグメンテーションの実行など）が可能になります。

ファイルを開いたり可視化パラメータを調整するための定型的なPythonコードを書く代わりに、やりたいことを説明するだけです：

:::prompt
Open the file `cells.tif`, apply a Gaussian blur with sigma=2, and then run Otsu thresholding to segment the cells. Show the segmentation as a labels layer on top of the original image.
:::

## はじめに

### 前提条件

- Python 3.10以上
- napariのインストール済み環境
- MCP対応AIクライアント（例：Claude Code）

### インストール

```bash
# PyPIからnapari-mcpをインストール
pip install napari-mcp

# またはソースからインストール
git clone https://github.com/ashbi-kyoto/napari-mcp.git
cd napari-mcp
pip install -e .
```

### MCPサーバーの起動

MCPサーバーを有効にしてnapariを起動します：

```bash
napari --with mcp
```

またはプログラムで起動：

```python
import napari
from napari_mcp import start_mcp_server

viewer = napari.Viewer()
start_mcp_server(viewer, port=8765)

napari.run()
```

## AIクライアントの接続

### Claude Code

Claude Codeの設定にMCPサーバーを追加します：

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

接続後、AIとの会話からnapariを直接操作できます。

## ワークフロー例

### データの読み込みと可視化

:::prompt
Load the image stack at `~/data/embryo_timelapse.tif`. Set the colormap to `magma` and adjust the contrast limits so the dim structures are visible.
:::

### セグメンテーションの実行

:::prompt
Take the current image layer and segment the nuclei using the following steps:
1. Apply a median filter (size=3) to reduce noise
2. Use Otsu thresholding to create a binary mask
3. Apply watershed segmentation to separate touching nuclei
4. Add the result as a labels layer called "nuclei_segmentation"
:::

### バッチ処理

```python
# napari-MCPの操作を直接スクリプトで実行することも可能
from napari_mcp import NapariClient

client = NapariClient()

# すべてのレイヤーを一覧表示
layers = client.list_layers()
print(f"現在のレイヤー: {[l.name for l in layers]}")

# 新しい画像を追加
client.add_image("path/to/image.tif", name="my_image")

# スクリーンショットを撮影
client.screenshot("output.png")
```

## 利用可能なMCPツール

napari MCPサーバーはAIクライアントに以下のツールを公開します：

- **`init_viewer`** — 新しいnapariビューアを開く
- **`add_layer`** — 画像、ラベル、ポイント、シェイプレイヤーを読み込む
- **`list_layers`** — 現在のすべてのレイヤーとプロパティを一覧表示
- **`set_layer_properties`** — カラーマップ、透明度、コントラスト制限などを調整
- **`execute_code`** — napariコンテキストで任意のPythonコードを実行
- **`screenshot`** — 現在のビューアを画像としてキャプチャ
- **`apply_to_layers`** — 既存のレイヤーにフィルターや変換を適用

## 次のステップ

- [napariプラグインエコシステム](https://napari-hub.org)で専門的な分析ツールを探索
- [MCP仕様書](https://modelcontextprotocol.io)でAIツール統合の仕組みを理解
- カスタム分析パイプライン用の独自MCPツールの構築に挑戦
