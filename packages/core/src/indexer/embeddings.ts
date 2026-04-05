export interface SemanticSearchResult {
  filePath: string;
  symbolName: string;
  symbolType: string;
  line: number;
  score: number;
  context: string;
}

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
}

export class LocalEmbeddings {
  async initialize(): Promise<void> {
  }

  async embed(text: string): Promise<EmbeddingResult> {
    return this.simpleEmbedding(text);
  }

  private simpleEmbedding(text: string): EmbeddingResult {
    const words = text.toLowerCase().split(/\s+/);
    const dimensions = 384;
    const vector = new Array(dimensions).fill(0);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) * (j + 1) * 31 + i * 7) % dimensions;
        vector[idx] += 1;
      }
    }

    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= magnitude;
      }
    }

    return { vector, dimensions };
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
}

export class SemanticCodeSearch {
  private embeddings: LocalEmbeddings;
  private codeIndex: Map<string, { embedding: number[]; metadata: { path: string; symbols: string[]; content: string } }> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.embeddings = new LocalEmbeddings();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.embeddings.initialize();
    this.initialized = true;
  }

  async indexFile(path: string, content: string, symbols: string[]): Promise<void> {
    await this.initialize();

    const combinedText = `${content}\n\nSymbols: ${symbols.join(', ')}`;
    const embedding = await this.embeddings.embed(combinedText);

    this.codeIndex.set(path, {
      embedding: embedding.vector,
      metadata: { path, symbols, content }
    });
  }

  async search(query: string, topK: number = 5): Promise<SemanticSearchResult[]> {
    await this.initialize();

    const queryEmbedding = await this.embeddings.embed(query);
    const results: SemanticSearchResult[] = [];

    for (const [path, data] of this.codeIndex) {
      const score = this.embeddings.cosineSimilarity(queryEmbedding.vector, data.embedding);
      const filename = path.split('/').pop() || path;

      results.push({
        filePath: path,
        symbolName: data.metadata.symbols[0] || filename,
        symbolType: 'function',
        line: 0,
        score,
        context: `Found ${data.metadata.symbols.length} symbols in ${filename}`
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  getIndexedFiles(): string[] {
    return Array.from(this.codeIndex.keys());
  }

  clear(): void {
    this.codeIndex.clear();
  }
}

let globalSemanticSearch: SemanticCodeSearch | null = null;

export function getSemanticSearch(): SemanticCodeSearch {
  if (!globalSemanticSearch) {
    globalSemanticSearch = new SemanticCodeSearch();
  }
  return globalSemanticSearch;
}

export async function initializeSemanticSearch(): Promise<void> {
  const search = getSemanticSearch();
  await search.initialize();
}