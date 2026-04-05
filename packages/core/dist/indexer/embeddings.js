export class LocalEmbeddings {
    async initialize() {
    }
    async embed(text) {
        return this.simpleEmbedding(text);
    }
    simpleEmbedding(text) {
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
    cosineSimilarity(a, b) {
        if (a.length !== b.length)
            return 0;
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
    embeddings;
    codeIndex = new Map();
    initialized = false;
    constructor() {
        this.embeddings = new LocalEmbeddings();
    }
    async initialize() {
        if (this.initialized)
            return;
        await this.embeddings.initialize();
        this.initialized = true;
    }
    async indexFile(path, content, symbols) {
        await this.initialize();
        const combinedText = `${content}\n\nSymbols: ${symbols.join(', ')}`;
        const embedding = await this.embeddings.embed(combinedText);
        this.codeIndex.set(path, {
            embedding: embedding.vector,
            metadata: { path, symbols, content }
        });
    }
    async search(query, topK = 5) {
        await this.initialize();
        const queryEmbedding = await this.embeddings.embed(query);
        const results = [];
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
    getIndexedFiles() {
        return Array.from(this.codeIndex.keys());
    }
    clear() {
        this.codeIndex.clear();
    }
}
let globalSemanticSearch = null;
export function getSemanticSearch() {
    if (!globalSemanticSearch) {
        globalSemanticSearch = new SemanticCodeSearch();
    }
    return globalSemanticSearch;
}
export async function initializeSemanticSearch() {
    const search = getSemanticSearch();
    await search.initialize();
}
//# sourceMappingURL=embeddings.js.map