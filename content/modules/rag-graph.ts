import type { Module } from "@/lib/types";

export const ragGraph: Module = {
  id: "rag-graph",
  title: "RAG and knowledge graph",
  short: "Find the right passage, prove it, and add graph edges where vectors miss.",
  layer: 2,
  depth: "deep",
  what:
    "Retrieval-augmented generation puts retrieved text in front of the model at answer time. This module builds hybrid retrieval (vector plus keyword) over Postgres, an authority-aware ranking step, two kinds of graph expansion, and a cheap claims store for definitions.",
  why:
    "The knowledge in a RAG system is in the store, and the model weights stay unchanged. An answer is grounded only if a tool call returned the passage in that conversation. Retrieval quality therefore sets the ceiling on answer quality, and it has to be measured separately from the chat model.",
  how: [
    "Documents are split into chunks. Each chunk gets an embedding vector and a full-text index entry.",
    "A query runs twice: nearest vectors (dense) and keyword match (lexical). Reciprocal rank fusion merges the two ranked lists without needing comparable scores.",
    "A small authority weight nudges primary sources above summaries of them. Duplicate passages that appear in several files collapse to one.",
    "Graph edges add passages that similarity search cannot reach. Citation edges follow references from a hit to the passage it cites. Definition edges fetch the passage that defines a term the question uses.",
    "A separate claims table stores short verified statements with full-text search. It answers definition questions without loading the embedding model.",
  ],
  prereqs: [
    {
      id: "inference",
      why: "Search needs an embedding model at query time and at index time. The vector column width is fixed by that model, so the model choice comes first.",
      stub: "A function that hashes text into a fixed-length vector. Plumbing works, results are meaningless.",
    },
    {
      id: "knowledge",
      why: "Retrieval can only return what was ingested, and it ranks by signals created at ingestion: chunk boundaries, source paths, authority tiers. Curation mistakes become retrieval mistakes that no ranking fix removes.",
      stub: "Three or four hand-written text files in one folder.",
    },
    {
      id: "state",
      why: "Chunks, vectors, the file ledger, and graph edges need a store that survives concurrent readers and a nightly writer. The reference build lost weeks to single-writer stores before moving to Postgres.",
      stub: "An in-memory list with brute-force cosine similarity. Fine up to a few thousand chunks.",
    },
  ],
  inBuild: [
    { path: "apps/agent-server/pgschema.sql", role: "Schemas: learned knowledge, the file ledger, and one chunk index per collection." },
    { path: "apps/agent-server/kb_ingest.py", role: "Extract, chunk, embed, and record files by content hash." },
    { path: "apps/agent-server/tools/knowledge_base.py", role: "The search tool: hybrid SQL, fusion, authority weight, dedup, graph expansion, trace log." },
    { path: "apps/agent-server/tools/recall_claims.py", role: "Full-text recall over verified claims, returned with the source passage." },
    { path: "apps/agent-server/nightly/defines.py", role: "Builds definition edges from set definitional forms." },
    { path: "apps/agent-server/nightly/citations.py", role: "Builds citation edges between passages." },
    { path: "knowledge-bank/source_authority.json", role: "Path rules that assign each source an authority tier." },
  ],
  flow: {
    caption: "One search, from question to returned passages",
    stages: [
      { label: "Question", detail: "Plus the collection to search. Collections are separate indexes on purpose.", kind: "input" },
      { label: "Embed the query", detail: "Same model that embedded the chunks. Different models are not comparable.", kind: "model" },
      { label: "Dense top N", detail: "Nearest vectors through the HNSW index. Finds paraphrases.", kind: "store" },
      { label: "Lexical top N", detail: "Full-text match ranked by cover density. Finds exact terms, codes, and section numbers.", kind: "store" },
      { label: "Fuse with RRF", detail: "Score is the sum of 1/(60 + rank) across the two lists.", kind: "check" },
      { label: "Authority and dedup", detail: "Small tier bonus. One copy of a paragraph that exists in several files.", kind: "check" },
      { label: "Graph expansion", detail: "Add cited passages and defining passages when the question type calls for it.", kind: "tool" },
      { label: "Return with sources", detail: "Text, source file, chunk position, and a diagnostic when nothing matched.", kind: "output" },
    ],
  },
  steps: [
    {
      title: "Validate documents before indexing anything",
      why: "Indexing is expensive and garbage is silent. A bad file produces confident chunks that rank well for the wrong reasons.",
      body: [
        "Check file type by content, not by extension or size. On the reference build, 15 files with a .pdf extension were HTML error pages that passed a size check.",
        "Fix the folder taxonomy and file names first. Source path is a ranking signal later.",
      ],
      code: {
        lang: "python",
        text: `def is_real_pdf(path: str) -> bool:
    with open(path, "rb") as f:
        return f.read(5) == b"%PDF-"`,
      },
      verify: "Every file in the bank passes a magic-byte check for its type.",
    },
    {
      title: "Create the store with one index per collection",
      why: "The schema fixes the vector width and the isolation boundaries. Changing either after loading millions of rows means a rebuild.",
      body: [
        "Use Postgres with the pgvector extension. It gives crash-safe tables, concurrent readers and writers, and full-text search in the same database as the vectors.",
        "Give each collection its own chunk table and its own indexes. An ingest for one collection then cannot damage another.",
        "Keep a file ledger keyed by content hash so re-ingestion skips unchanged files.",
      ],
      code: {
        lang: "sql",
        file: "pgschema.sql (reduced)",
        text: `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE kb.files (
  collection text NOT NULL,
  source     text NOT NULL,
  sha256     text NOT NULL,
  status     text NOT NULL DEFAULT 'indexed',
  PRIMARY KEY (collection, source)
);

CREATE TABLE kb_finance.chunks (
  chunk_id    text PRIMARY KEY,          -- "<source>::<n>"
  source      text NOT NULL,
  chunk_index int  NOT NULL,
  text        text NOT NULL,
  context     text,                      -- short lead-in describing the document
  embedding   halfvec(768),              -- width set by the embedding model
  retired     boolean NOT NULL DEFAULT false
);

CREATE INDEX chunks_fts_idx ON kb_finance.chunks
  USING gin (to_tsvector('english', coalesce(context,'') || ' ' || text));`,
      },
      verify: "`\\d kb_finance.chunks` shows the vector column and the GIN index.",
    },
    {
      title: "Chunk with a context line, then embed",
      why: "Chunking decides what a hit can contain. It comes before embedding because the embedding is of the chunk text, and you cannot re-chunk without re-embedding.",
      body: [
        "The reference build uses 800-character chunks with 100 characters of overlap. Start there and change it only with a retrieval eval in hand.",
        "Store a short context string per chunk naming the document and section. It is included in the full-text index so a chunk can match on its document's title.",
        "Embed in batches and record each file's hash in the ledger when its chunks are committed.",
      ],
      code: {
        lang: "python",
        text: `def chunk(text: str, size: int = 800, overlap: int = 100):
    step = size - overlap
    for i in range(0, max(len(text) - overlap, 1), step):
        yield text[i:i + size]

async def embed(text: str) -> list[float]:
    r = await http.post(f"{OLLAMA_URL}/api/embeddings",
                        json={"model": "nomic-embed-text", "prompt": text})
    return r.json()["embedding"]`,
      },
      verify: "Row count in the chunk table matches your expectation for the corpus, and no embedding is null.",
    },
    {
      title: "Bulk load first, build the vector index after",
      why: "Building an HNSW graph row by row during a large load is hours slower than building it once at the end.",
      body: [
        "Load all rows, then create the index. Raise the search breadth parameter at query time if recall matters more than a few milliseconds.",
      ],
      code: {
        lang: "sql",
        text: `CREATE INDEX chunks_hnsw_idx ON kb_finance.chunks
  USING hnsw (embedding halfvec_cosine_ops);

SET hnsw.ef_search = 1000;   -- per session, recall over speed`,
      },
      verify: "EXPLAIN on a nearest-neighbor query shows an index scan on the HNSW index.",
    },
    {
      title: "Write the hybrid query with rank fusion",
      why: "Dense and lexical search fail on different questions. You need both lists before you can fuse them, and fusion by rank avoids calibrating two unrelated score scales.",
      body: [
        "Take the top N from each side. Give every chunk a score of 1/(k + rank) per list and sum. The constant k is 60 by convention and results are not sensitive to it.",
        "Pass the query vector as a parameter in the ORDER BY. On the reference build the vector first went through a CTE, which hid it from the planner. Every search scanned 2.4 million rows and took 5.4 seconds. As a direct parameter it uses the index and runs in under 2 seconds.",
      ],
      code: {
        lang: "sql",
        file: "knowledge_base.py (hybrid SQL, reduced)",
        text: `WITH q AS (SELECT websearch_to_tsquery('english', %(text)s) AS t),
dense AS (
  SELECT chunk_id, row_number() OVER (ORDER BY d) AS r
  FROM (SELECT chunk_id, embedding <=> %(vec)s::halfvec(768) AS d
        FROM kb_finance.chunks
        WHERE NOT retired AND embedding IS NOT NULL
        ORDER BY embedding <=> %(vec)s::halfvec(768)
        LIMIT %(n)s) c
),
lexical AS (
  SELECT chunk_id, row_number() OVER (ORDER BY rank DESC) AS r
  FROM (SELECT chunk_id,
               ts_rank_cd(to_tsvector('english', coalesce(context,'') || ' ' || text), q.t) AS rank
        FROM kb_finance.chunks, q
        WHERE NOT retired
          AND to_tsvector('english', coalesce(context,'') || ' ' || text) @@ q.t
        ORDER BY rank DESC LIMIT %(n)s) l
),
fused AS (
  SELECT chunk_id, sum(1.0 / (60 + r)) AS rrf
  FROM (SELECT chunk_id, r FROM dense UNION ALL SELECT chunk_id, r FROM lexical) u
  GROUP BY chunk_id
)
SELECT c.chunk_id, f.rrf, c.source, c.chunk_index, c.text
FROM fused f JOIN kb_finance.chunks c USING (chunk_id)
ORDER BY f.rrf DESC
LIMIT %(n)s;`,
      },
      verify: "A question that uses an exact section number and a paraphrased question both return the right passage in the top five.",
    },
    {
      title: "Add authority weighting and passage dedup",
      why: "These operate on a fused candidate list, so they follow fusion. They fix two failures you only see once search works: a summary outranking the rule it summarizes, and ten results that are one paragraph copied across files.",
      body: [
        "Assign each source a tier from path rules. Add a small bonus per tier. On the reference build the weight is 0.08, enough to break near-ties and too small to override relevance.",
        "Collapse identical passages to one result. Track how many distinct passages are in the top ten as an eval metric.",
        "A cross-encoder reranker over the top 30 is optional. Add it behind a flag and keep it only if the eval moves.",
      ],
      verify: "For a known rule, the primary source ranks above documents that quote it.",
    },
    {
      title: "Add graph edges for the question types vectors miss",
      why: "Graph expansion needs a working baseline to expand from, and it needs evidence of which questions fail. Building a graph first is how projects spend a month on infrastructure for a problem they have not measured.",
      body: [
        "Citation edges: when a passage says \"see section X\", store an edge to that passage. At query time, follow edges from top hits and add a bounded number of cited passages.",
        "Definition edges: detect set definitional forms (\"X means\", \"the term X refers to\") at index time and store an edge from the term to the defining passage. For definitional questions, add those passages.",
        "Both are plain tables with a from and a to column. The reference build deferred a full entity-graph system until simpler tiers were shown to fail.",
      ],
      code: {
        lang: "sql",
        text: `CREATE TABLE brain.atom_links (
  from_id  text NOT NULL,
  to_id    text NOT NULL,
  relation text NOT NULL,          -- 'cites' | 'defines'
  PRIMARY KEY (from_id, to_id, relation)
);`,
      },
      verify: "A definitional gold set scores higher with definition edges on than off. If it does not, turn them off.",
    },
    {
      title: "Add a claims store for cheap recall",
      why: "It depends on having passages to cite. It exists because loading the embedder can evict the chat model, and many questions only need a definition.",
      body: [
        "Store short statements extracted from sources, each with a status and a pointer to its source passage. Index the statement text for full-text search.",
        "Return the source passage beside each claim and tell the model that the passage is the authority. A claim is a pointer to evidence.",
      ],
      verify: "A definition question is answered through the claims tool with no embedding model load in the engine log.",
    },
    {
      title: "Expose search as a tool that explains empty results",
      why: "The tool wrapper is last because it wraps everything above. It is the interface the harness sees.",
      body: [
        "Return passages with source and position. When nothing matches, return a diagnostic naming the filter that emptied the result.",
        "Write one trace line per search: query, candidate counts per side, final ranks. Offline diagnosis depends on it.",
      ],
      code: {
        lang: "python",
        text: `SCHEMA = {
  "type": "function",
  "function": {
    "name": "search_knowledge_base",
    "description": "Search a document collection. Returns passages with source and position.",
    "parameters": {
      "type": "object",
      "properties": {
        "collection": {"type": "string", "enum": ["FINANCE", "K12"]},
        "query": {"type": "string"},
        "top_k": {"type": "integer", "default": 6}
      },
      "required": ["collection", "query"]
    }
  }
}`,
      },
      verify: "A query with no match returns an empty list and a diagnostic string, and a trace line is written.",
    },
  ],
  together: [
    { with: "harness", how: "The planner decides when to search and may search again after reading results. Retrieval is a tool, so its output size is capped by the harness." },
    { with: "guardrails", how: "The guard compares the answer with what retrieval returned in this request. Retrieval output is the evidence." },
    { with: "evaluation", how: "A sealed gold set scores retrieval alone, so a chunking or ranking change shows up as a number." },
    { with: "self-evolving", how: "The nightly learner reads chunks and writes claims. Held-out chunks are excluded so the learner cannot study the test." },
  ],
  failures: [
    {
      when: "2026-08",
      title: "A corrupt vector segment stopped sync for four weeks",
      what: "The single-process vector store had one unreadable segment. Search on the main collection failed and ingestion could not proceed.",
      fix: "Move vectors into Postgres tables with write-ahead logging and a rebuildable index.",
      lesson: "Treat the vector index as derived data that can be rebuilt from rows you trust.",
    },
    {
      when: "2026-09",
      title: "Every search scanned the whole table",
      what: "The query vector was passed through a CTE. The planner could not use the HNSW index and each search took 5.4 seconds.",
      fix: "Pass the vector as a query parameter in the ORDER BY clause.",
      lesson: "Run EXPLAIN on the retrieval query. An index that exists is not an index that is used.",
    },
    {
      when: "2026-07",
      title: "One collection leaked into another",
      what: "Finance passages appeared in education-scoped chats because the knowledge attachment was set per model.",
      fix: "Separate indexes per collection and a deterministic scope filter.",
      lesson: "Isolation belongs in the data layout. A prompt instruction is not a boundary.",
    },
    {
      when: "2026-10",
      title: "The top ten was one paragraph ten times",
      what: "The same paragraph existed in several files and filled the result list.",
      fix: "Collapse duplicate passages and track distinct passages in the top ten as a metric.",
      lesson: "Measure diversity of results as well as rank of the right one.",
    },
  ],
  portability: {
    databricks:
      "Vector Search with a Delta Sync index replaces the chunk table and HNSW index, and it offers hybrid search. Chunks live in a Delta table governed by Unity Catalog. Graph edges are Delta tables you join. Lakebase gives you Postgres if you want to keep this SQL as written.",
    watsonx:
      "watsonx.data provides the lakehouse and a vector engine (Milvus). Orchestrate agents attach knowledge bases backed by it. You keep the same pipeline stages: validate, chunk, embed, hybrid query, rerank.",
    codex:
      "Codex does not provide a retrieval store. Run this stack as a service and expose search as an MCP tool. Codex then calls it like any other tool.",
    cursor:
      "Cursor indexes your code for its own use. Domain retrieval is yours to host. Register your search service as an MCP server in the project config.",
    claude:
      "Expose the search tool through an MCP server. The reference build does this so a coding agent and the chat agent share one retrieval implementation.",
    other:
      "Postgres with pgvector runs anywhere, including Docker. The SQL in this module is unchanged. Only the embedding endpoint URL differs.",
  },
  checks: [
    {
      q: "Why hybrid search and not vectors alone?",
      a: "Vectors match meaning and miss exact tokens such as section numbers, codes, and rare terms. Keyword search does the reverse. The two fail on different questions, so fusing both ranked lists covers more than either.",
    },
    {
      q: "Why does rank fusion use ranks and not scores?",
      a: "Cosine distance and text rank are on unrelated scales. Ranks are comparable across any two lists, so fusion needs no calibration.",
    },
    {
      q: "Why must knowledge management come before retrieval?",
      a: "Ranking uses signals made at ingestion: chunk boundaries, source paths, authority tiers, and which files exist. Bad inputs produce confident wrong hits, and no query-time step can recover text that was never ingested correctly.",
    },
    {
      q: "Why are graph edges added after hybrid search works?",
      a: "Edges expand from an initial hit list, so they need one. You also need failing questions to know which edges to build. The reference build added citation and definition edges because specific gold questions failed without them.",
    },
    {
      q: "Explain the claims store in one sentence to someone who knows RAG.",
      a: "It is a full-text index over short verified statements that each point at a source passage, used to answer definition questions without loading the embedding model.",
    },
  ],
  terms: [
    { term: "RRF", def: "Reciprocal rank fusion. Score is the sum over lists of 1/(k + rank)." },
    { term: "HNSW", def: "A graph index for approximate nearest-neighbor search over vectors." },
    { term: "hit@k", def: "Share of questions whose gold passage is in the top k results." },
    { term: "Authority tier", def: "A trust level assigned to a source by path rule, used as a small ranking bonus." },
  ],
};
