---
title: バイオインフォマティクスのためのPython入門
links:
  - label: Biopython ドキュメント
    url: https://biopython.org/wiki/Documentation
---

## はじめに

このチュートリアルでは、バイオインフォマティクス研究のためのPython環境のセットアップを解説します。必須ライブラリの導入、生物学的配列データの読み込みと操作、そしてASHBiでの計算生物学ワークフローで一般的な基本的な分析方法をカバーします。

チュートリアル終了時には、`Biopython`、`pandas`、`matplotlib`が使える研究環境が整います。

## 環境のセットアップ

まず、このチュートリアル用の専用conda環境を作成しましょう。環境を分離することは、プロジェクト間の依存関係の競合を防ぐベストプラクティスです。

```bash
# Create a new environment
conda create -n bioinfo python=3.11
conda activate bioinfo

# Install essential packages
pip install biopython pandas matplotlib seaborn
```

## 配列データの読み込み

Biopythonの`SeqIO`モジュールは、生物学的配列ファイルを読み込む標準的な方法です。FASTA���GenBankなど多くのフォーマットに対応しています。

```python
from Bio import SeqIO

# Read a FASTA file
records = []
for record in SeqIO.parse("sequences.fasta", "fasta"):
    print(f"ID: {record.id}, Length: {len(record.seq)}")
    records.append(record)

print(f"Total sequences: {len(records)}")
```

### 出力の理解

各`SeqRecord`オブジェクトには、配列ID、実際の配列文字列、オプションのアノテーションが含まれます。これはバイオインフォマティクスパイプラインで使用する基本的なデータ構造です。

## AIを使って分析を加速する

大規模言語モデルは、バイオインフォマティクスのコードの作成とデバッグに役立ちます。以下は試すことができるプロンプトの例です：

:::prompt
I have a FASTA file with protein sequences. Write a Python script using Biopython that:
1. Reads all sequences from the file
2. Calculates the molecular weight of each protein
3. Identifies sequences longer than 500 amino acids
4. Exports results to a CSV file with columns: ID, length, molecular_weight
:::

## 結果の可視化

`matplotlib`と`seaborn`を使って、配列長の分布を簡単に可視化してみましょう：

```python
import matplotlib.pyplot as plt
import seaborn as sns

# Calculate lengths
lengths = [len(rec.seq) for rec in records]

# Plot distribution
fig, ax = plt.subplots(figsize=(10, 5))
sns.histplot(lengths, bins=50, color="#0077BE", ax=ax)
ax.set_xlabel("Sequence Length (bp)")
ax.set_ylabel("Count")
ax.set_title("Distribution of Sequence Lengths")
plt.tight_layout()
plt.savefig("length_distribution.png", dpi=150)
plt.show()
```

## 次のステップ

バイオインフォマティクス環境が整ったので、表形式データのワークフローについては**Pandasによるデータ分析**チュートリアルを参照するか、顕微鏡画像を扱う場合は**napariによる細胞セグメンテーション**を試してみてください。
