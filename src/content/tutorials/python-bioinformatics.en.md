---
title: Getting Started with Python for Bioinformatics
tags: [python, bioinformatics, beginner]
updated: "2026-04"
duration: 12
hasVideo: true
githubUrl: https://github.com/ashbi-kyoto/python-bioinformatics
links:
  - label: Biopython Documentation
    url: https://biopython.org/wiki/Documentation
---

## Introduction

This tutorial will walk you through setting up Python for bioinformatics research. We'll cover the essential libraries, how to read and manipulate biological sequence data, and how to perform basic analyses that are common in computational biology workflows at ASHBi.

By the end, you'll have a working environment with `Biopython`, `pandas`, and `matplotlib` ready for your research.

## Setting Up Your Environment

First, let's create a dedicated conda environment for this tutorial. Using isolated environments is a best practice that prevents dependency conflicts between projects.

```bash
# Create a new environment
conda create -n bioinfo python=3.11
conda activate bioinfo

# Install essential packages
pip install biopython pandas matplotlib seaborn
```

## Reading Sequence Data

Biopython's `SeqIO` module is the standard way to read biological sequence files. It supports FASTA, GenBank, and many other formats.

```python
from Bio import SeqIO

# Read a FASTA file
records = []
for record in SeqIO.parse("sequences.fasta", "fasta"):
    print(f"ID: {record.id}, Length: {len(record.seq)}")
    records.append(record)

print(f"Total sequences: {len(records)}")
```

### Understanding the Output

Each `SeqRecord` object contains the sequence ID, the actual sequence string, and optional annotations. This is the fundamental data structure you'll work with throughout your bioinformatics pipeline.

## Using AI to Accelerate Your Analysis

Large language models can help you write and debug bioinformatics code. Here's an example prompt you can try:

:::prompt
I have a FASTA file with protein sequences. Write a Python script using Biopython that:
1. Reads all sequences from the file
2. Calculates the molecular weight of each protein
3. Identifies sequences longer than 500 amino acids
4. Exports results to a CSV file with columns: ID, length, molecular_weight
:::

## Visualizing Your Results

Let's create a quick visualization of sequence length distribution using `matplotlib` and `seaborn`:

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

## Next Steps

Now that you have a working bioinformatics environment, explore the **Pandas for Data Analysis** tutorial for tabular data workflows, or try **Cell Segmentation with napari** if your work involves microscopy images.
