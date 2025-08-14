// src/modules/agent/vector.store.test.ts
import { OpenAIEmbeddings } from "@langchain/openai";
import initVectorStore from "./vector.store";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { initGraph, close } from "../graph";

describe("Vector Store (Scope 3)", () => {
  afterAll(async () => await close());

  const mkEmbeddings = () =>
    new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY as string,
      configuration: { baseURL: process.env.OPENAI_API_BASE },
    });

  it("instantiates from existing Scope-3 index", async () => {
    const graph = await initGraph();

    // pick any existing VECTOR index
    const indexes = await graph.query<{ name: string }>(
      `
      SHOW INDEXES YIELD name, type
      WHERE type = 'VECTOR'
      RETURN name
      LIMIT 1
      `,
      {},
      "READ"
    );
    if (!indexes.length) {
      console.warn("No VECTOR index found; skipping.");
      return;
    }
    process.env.EMBEDDING_INDEX = indexes[0].name;

    // use a real Emissionscope label from your data (e.g., "Efficiency", "Asia")
    const scope = await graph.query<{ label: string }>(
      `
      MATCH (c:Emissionscope)
      RETURN coalesce(c.name, toString(c.id)) AS label
      LIMIT 1
      `,
      {},
      "READ"
    );
    const scopeLabel = scope[0]?.label ?? "Efficiency";

    const embeddings = mkEmbeddings();
    const store = await initVectorStore(embeddings);
    expect(store).toBeInstanceOf(Neo4jVectorStore);

    // ✅ proper template literal (no backslash before backticks)
    const results = await store.similaritySearch(
      `Scope 3 ${scopeLabel} emissions`,
      2
    );
    expect(Array.isArray(results)).toBe(true);

    await store.close();
  });

  it("creates a test index (isolated)", async () => {
    const indexName = "test-scope3-index";
    const embeddings = mkEmbeddings();

    const store = await Neo4jVectorStore.fromTexts(
      [
        "Acme Corp — Efficiency emissions (2022): 1.2 MtCO2e.",
        "Global Foods — Asia logistics emissions (2023): 0.8 MtCO2e.",
      ],
      [],
      embeddings,
      {
        url: process.env.NEO4J_URI as string,
        username: process.env.NEO4J_USERNAME as string,
        password: process.env.NEO4J_PASSWORD as string,
        nodeLabel: "TestChunk",
        textNodeProperty: "text",
        embeddingNodeProperty: "embedding",
        indexName,
      }
    );

    expect(store).toBeInstanceOf(Neo4jVectorStore);
    expect((store as any).indexName).toBe(indexName);

    const r = await store.similaritySearch("Acme Efficiency 2022", 1);
    expect(r[0].pageContent).toMatch(/Acme Corp/i);

    await store.close();
  });
});

// import { OpenAIEmbeddings } from "@langchain/openai";
// import initVectorStore from "./vector.store";
// import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
// import { close } from "../graph";

// describe("Vector Store", () => {
//   afterAll(() => close());

//   it("should instantiate a new vector store", async () => {
//     const embeddings = new OpenAIEmbeddings({
//       openAIApiKey: process.env.OPENAI_API_KEY as string,
//       configuration: {
//         baseURL: process.env.OPENAI_API_BASE,
//       },
//     });
//     const vectorStore = await initVectorStore(embeddings);
//     expect(vectorStore).toBeInstanceOf(Neo4jVectorStore);

//     await vectorStore.close();
//   });

//   it("should create a test index", async () => {
//     const indexName = "test-index";
//     const embeddings = new OpenAIEmbeddings({
//       openAIApiKey: process.env.OPENAI_API_KEY as string,
//       configuration: {
//         baseURL: process.env.OPENAI_API_BASE,
//       },
//     });

//     const index = await Neo4jVectorStore.fromTexts(
//       ["Neo4j GraphAcademy offers free, self-paced online training"],
//       [],
//       embeddings,
//       {
//         url: process.env.NEO4J_URI as string,
//         username: process.env.NEO4J_USERNAME as string,
//         password: process.env.NEO4J_PASSWORD as string,
//         nodeLabel: "Test",
//         embeddingNodeProperty: "embedding",
//         textNodeProperty: "text",
//         indexName,
//       }
//     );

//     expect(index).toBeInstanceOf(Neo4jVectorStore);
//     expect(index["indexName"]).toBe(indexName);

//     await index.close();
//   });
// });
