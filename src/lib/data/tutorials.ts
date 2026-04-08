import type { Tutorial } from './types';

export const tutorials: Tutorial[] = [
	{
		slug: 'python-bioinformatics',
		title: {
			en: 'Getting Started with Python for Bioinformatics',
			ja: 'バイオインフォマティクスのためのPython入門'
		},
		tags: ['python', 'bioinformatics', 'beginner'],
		updatedDate: '2026-04',
		durationMinutes: 12,
		hasVideo: true,
		githubUrl: 'https://github.com/ashbi-kyoto/python-bioinformatics',
		links: [
			{
				label: { en: 'Biopython Documentation', ja: 'Biopython ドキュメント' },
				url: 'https://biopython.org/wiki/Documentation'
			}
		],
		content: [
			{
				type: 'heading',
				level: 2,
				text: { en: 'Introduction', ja: 'はじめに' }
			},
			{
				type: 'text',
				body: {
					en: "This tutorial will walk you through setting up Python for bioinformatics research. We'll cover the essential libraries, how to read and manipulate biological sequence data, and how to perform basic analyses that are common in computational biology workflows at ASHBi.",
					ja: 'このチュートリアルでは、バイオインフォマティクス研究のためのPython環境のセットアップを解説します。必須ライブラリの導入、生物学的配列データの読み込みと操作、そしてASHBiでの計算生物学ワークフローで一般的な基本的な分析方法をカバーします。'
				}
			},
			{
				type: 'text',
				body: {
					en: "By the end, you'll have a working environment with `Biopython`, `pandas`, and `matplotlib` ready for your research.",
					ja: 'チュートリアル終了時には、`Biopython`、`pandas`、`matplotlib`が使える研究環境が整います。'
				}
			},
			{
				type: 'heading',
				level: 2,
				text: { en: 'Setting Up Your Environment', ja: '環境のセットアップ' }
			},
			{
				type: 'text',
				body: {
					en: "First, let's create a dedicated conda environment for this tutorial. Using isolated environments is a best practice that prevents dependency conflicts between projects.",
					ja: 'まず、このチュートリアル用の専用conda環境を作成しましょう。環境を分離することは、プロジェクト間の依存関係の競合を防ぐベストプラクティスです。'
				}
			},
			{
				type: 'code',
				language: 'bash',
				code: `# Create a new environment
conda create -n bioinfo python=3.11
conda activate bioinfo

# Install essential packages
pip install biopython pandas matplotlib seaborn`
			},
			{
				type: 'heading',
				level: 2,
				text: { en: 'Reading Sequence Data', ja: '配列データの読み込み' }
			},
			{
				type: 'text',
				body: {
					en: "Biopython's `SeqIO` module is the standard way to read biological sequence files. It supports FASTA, GenBank, and many other formats.",
					ja: 'Biopythonの`SeqIO`モジュールは、生物学的配列ファイルを読み込む標準的な方法です。FASTA、GenBankなど多くのフォーマットに対応しています。'
				}
			},
			{
				type: 'code',
				language: 'python',
				code: `from Bio import SeqIO

# Read a FASTA file
records = []
for record in SeqIO.parse("sequences.fasta", "fasta"):
    print(f"ID: {record.id}, Length: {len(record.seq)}")
    records.append(record)

print(f"Total sequences: {len(records)}")`
			},
			{
				type: 'heading',
				level: 3,
				text: { en: 'Understanding the Output', ja: '出力の理解' }
			},
			{
				type: 'text',
				body: {
					en: "Each `SeqRecord` object contains the sequence ID, the actual sequence string, and optional annotations. This is the fundamental data structure you'll work with throughout your bioinformatics pipeline.",
					ja: '各`SeqRecord`オブジェクトには、配列ID、実際の配列文字列、オプションのアノテーションが含まれます。これはバイオインフォマティクスパイプラインで使用する基本的なデータ構造です。'
				}
			},
			{
				type: 'heading',
				level: 2,
				text: {
					en: 'Using AI to Accelerate Your Analysis',
					ja: 'AIを使って分析を加速する'
				}
			},
			{
				type: 'text',
				body: {
					en: "Large language models can help you write and debug bioinformatics code. Here's an example prompt you can try:",
					ja: '大規模言語モデルは、バイオインフォマティクスのコードの作成とデバッグに役立ちます。以下は試すことができるプロンプトの例です：'
				}
			},
			{
				type: 'prompt',
				body: `I have a FASTA file with protein sequences. Write a Python script using Biopython that:
1. Reads all sequences from the file
2. Calculates the molecular weight of each protein
3. Identifies sequences longer than 500 amino acids
4. Exports results to a CSV file with columns: ID, length, molecular_weight`
			},
			{
				type: 'heading',
				level: 2,
				text: { en: 'Visualizing Your Results', ja: '結果の可視化' }
			},
			{
				type: 'text',
				body: {
					en: "Let's create a quick visualization of sequence length distribution using `matplotlib` and `seaborn`:",
					ja: '`matplotlib`と`seaborn`を使って、配列長の分布を簡単に可視化してみましょう：'
				}
			},
			{
				type: 'code',
				language: 'python',
				code: `import matplotlib.pyplot as plt
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
plt.show()`
			},
			{
				type: 'heading',
				level: 2,
				text: { en: 'Next Steps', ja: '次のステップ' }
			},
			{
				type: 'text',
				body: {
					en: 'Now that you have a working bioinformatics environment, explore the **Pandas for Data Analysis** tutorial for tabular data workflows, or try **Cell Segmentation with napari** if your work involves microscopy images.',
					ja: 'バイオインフォマティクス環境が整ったので、表形式データのワークフローについては**Pandasによるデータ分析**チュートリアルを参照するか、顕微鏡画像を扱う場合は**napariによる細胞セグメンテーション**を試してみてください。'
				}
			}
		]
	},
	{
		slug: 'pandas-eda',
		title: {
			en: 'Exploratory Data Analysis with Pandas',
			ja: 'Pandasによる探索的データ分析'
		},
		tags: ['python', 'data-analysis', 'pandas'],
		updatedDate: '2026-03',
		durationMinutes: 18,
		hasVideo: true,
		content: []
	},
	{
		slug: 'napari-cell-segmentation',
		title: {
			en: 'Cell Segmentation with napari and scikit-image',
			ja: 'napariとscikit-imageによる細胞セグメンテーション'
		},
		tags: ['python', 'image-analysis', 'napari', 'intermediate'],
		updatedDate: '2026-02',
		durationMinutes: 25,
		hasVideo: true,
		content: []
	},
	{
		slug: 'rnaseq-deseq2',
		title: {
			en: 'RNA-seq Differential Expression Analysis',
			ja: 'RNA-seq差次的発現解析'
		},
		tags: ['R', 'bioinformatics', 'RNA-seq', 'advanced'],
		updatedDate: '2026-01',
		hasVideo: false,
		content: []
	},
	{
		slug: 'setup-environment',
		title: {
			en: 'Setting Up Your Research Computing Environment',
			ja: '研究用コンピューティング環境のセットアップ'
		},
		tags: ['setup', 'conda', 'beginner'],
		updatedDate: '2026-04',
		durationMinutes: 8,
		hasVideo: true,
		content: []
	}
];

export function getTutorial(slug: string): Tutorial | undefined {
	return tutorials.find((t) => t.slug === slug);
}
