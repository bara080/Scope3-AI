// src/modules/agent/tools/vector-retrieval.chain.test.ts
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { config } from "dotenv";
import { BaseChatModel } from "langchain/chat_models/base";
import { Embeddings } from "langchain/embeddings/base";
import { Runnable } from "@langchain/core/runnables";
import initVectorRetrievalChain from "./vector-retrieval.chain";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { AgentToolInput } from "../agent.types";
import { close } from "../../graph";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";

describe("Vector Retrieval Chain", () => {
  let graph: Neo4jGraph;
  let llm: BaseChatModel;
  let embeddings: Embeddings;
  let chain: Runnable<AgentToolInput, string>;
  let createdStore: Neo4jVectorStore | null = null;

  // Ensure we have a usable VECTOR index (create a tiny one if missing)
  async function ensureVectorIndex(): Promise<string> {
    const rows = await graph.query<{ name: string }>(
      `
      SHOW INDEXES YIELD name, type
      WHERE type = 'VECTOR'
      RETURN name
      LIMIT 1
      `,
      {},
      "READ"
    );
    if (rows.length) return rows[0].name;

    const indexName = "test-scope3-index";
    createdStore = await Neo4jVectorStore.fromTexts(
      [
        "Efficiency emissions (2022): 1.2 MtCO2e.",
        "Efficiency emissions (2023): 1.3 MtCO2e.",
      ],
      [],
      embeddings,
      {
        url: process.env.NEO4J_URI as string,
        username: process.env.NEO4J_USERNAME as string,
        password: process.env.NEO4J_PASSWORD as string,
        nodeLabel: "Chunk", // from your graph screenshot
        textNodeProperty: "text",
        embeddingNodeProperty: "embedding",
        indexName,
      }
    );

    // Soft link a seeded :Chunk to any :Emissionscope (e.g., "Efficiency") if present
    await graph.query(
      `
      MATCH (c:Emissionscope)
      WITH c LIMIT 1
      MATCH (n:Chunk) WHERE n.text CONTAINS 'Efficiency'
      WITH c, n LIMIT 1
      MERGE (n)-[:MENTIONS]->(c)
      `,
      {},
      "WRITE"
    );

    return indexName;
  }

  beforeAll(async () => {
    config({ path: ".env.local" });

    graph = await Neo4jGraph.initialize({
      url: process.env.NEO4J_URI as string,
      username: process.env.NEO4J_USERNAME as string,
      password: process.env.NEO4J_PASSWORD as string,
      database: process.env.NEO4J_DATABASE as string | undefined,
    });

    llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-3.5-turbo",
      temperature: 0,
      configuration: { baseURL: process.env.OPENAI_API_BASE },
    });

    embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY as string,
      configuration: { baseURL: process.env.OPENAI_API_BASE },
    });

    // Ensure a usable VECTOR index and pass it to the vector store via env
    const indexName = await ensureVectorIndex();
    process.env.EMBEDDING_INDEX = indexName;

    chain = await initVectorRetrievalChain(llm, embeddings);
  });

  afterAll(async () => {
    if (createdStore) await createdStore.close();
    await graph.close();
    await close();
  });

  it("should provide a Scope-3 answer", async () => {
    const sessionId = "vector-retriever-1";
    const input = "[redacted]";
    const rephrasedQuestion =
      "Summarize Scope 3 Efficiency emissions for 2022–2023";

    const output = await chain.invoke(
      { input, rephrasedQuestion },
      { configurable: { sessionId } }
    );

    // Should generate an answer
    expect(output).toBeDefined();

    // Should save to the database (use :Chunk text, not movie titles)
    const res = await graph.query<any>(
      `
      MATCH (s:Session {id: $sessionId})-[:LAST_RESPONSE]->(r)
      RETURN
        s.id AS session,
        r.input AS input,
        r.output AS output,
        r.rephrasedQuestion AS rephrasedQuestion,
        [ (r)-[:CONTEXT]->(n) | coalesce(n.text, n.summary, n.id) ] AS context,
        toInteger(size([(r)-[:CONTEXT]->(x) | x])) AS contextCount
      ORDER BY r.createdAt DESC
      LIMIT 1
      `,
      { sessionId },
      "READ"
    );

    expect(res).toBeDefined();

    const [first] = res!;
    expect(first.input).toEqual(input);
    expect(first.rephrasedQuestion).toEqual(rephrasedQuestion);
    expect(first.output).toEqual(output);

    // Should save with context
    expect(Number(first.contextCount)).toBeGreaterThanOrEqual(1);

    // Answer should reference scope term or a context snippet
    const out = String(output).toLowerCase();
    const scopeMention =
      /efficiency|sustainability|asia|africa|global economy/.test(out);
    const snippetMention = (first.context as string[]).some((s) =>
      out.includes(
        String(s || "")
          .slice(0, 20)
          .toLowerCase()
      )
    );
    expect(scopeMention || snippetMention).toBe(true);
  });
});

// // src/modules/agent/tools/vector-retrieval.chain.test.ts
// import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
// import { config } from "dotenv";
// import { BaseChatModel } from "langchain/chat_models/base";
// import { Embeddings } from "langchain/embeddings/base";
// import { Runnable } from "@langchain/core/runnables";
// import initVectorRetrievalChain from "./vector-retrieval.chain";
// import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
// import { AgentToolInput } from "../agent.types";
// import { close } from "../../graph";
// import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";

// describe("Vector Retrieval Chain", () => {
//   let graph: Neo4jGraph;
//   let llm: BaseChatModel;
//   let embeddings: Embeddings;
//   let chain: Runnable<AgentToolInput, string>;
//   let store: Neo4jVectorStore | null = null;

//   beforeAll(async () => {
//     config({ path: ".env.local" });

//     graph = await Neo4jGraph.initialize({
//       url: process.env.NEO4J_URI as string,
//       username: process.env.NEO4J_USERNAME as string,
//       password: process.env.NEO4J_PASSWORD as string,
//       database: process.env.NEO4J_DATABASE as string | undefined,
//     });

//     llm = new ChatOpenAI({
//       openAIApiKey: process.env.OPENAI_API_KEY,
//       modelName: "gpt-3.5-turbo",
//       temperature: 0,
//       configuration: { baseURL: process.env.OPENAI_API_BASE },
//     });

//     embeddings = new OpenAIEmbeddings({
//       openAIApiKey: process.env.OPENAI_API_KEY as string,
//       configuration: { baseURL: process.env.OPENAI_API_BASE },
//     });

//     // ---- ensure an Emissionscope node exists (from your screenshot label set)
//     const scopeRow = await graph.query<{ label: string }>(
//       `
//       MATCH (c:Emissionscope)
//       RETURN coalesce(c.name, toString(c.id)) AS label
//       ORDER BY label
//       LIMIT 1
//       `,
//       {},
//       "READ"
//     );
//     if (!scopeRow.length) {
//       throw new Error("No :Emissionscope nodes found (e.g., 'Efficiency').");
//     }
//     const scopeLabel = scopeRow[0].label;

//     // ---- ensure a VECTOR index exists; if not, create a temp one and link a Chunk -> Emissionscope
//     const existing = await graph.query<{ name: string }>(
//       `
//       SHOW INDEXES YIELD name, type
//       WHERE type = 'VECTOR'
//       RETURN name
//       LIMIT 1
//       `,
//       {},
//       "READ"
//     );

//     let indexName = process.env.EMBEDDING_INDEX || existing[0]?.name;
//     if (!indexName) {
//       indexName = "doc-embeddings";
//       // create a small test index on :Chunk(text, embedding)
//       store = await Neo4jVectorStore.fromTexts(
//         [
//           `${scopeLabel} emissions (2022): 1.2 MtCO2e.`,
//           `${scopeLabel} emissions (2023): 1.3 MtCO2e.`,
//         ],
//         [],
//         embeddings,
//         {
//           url: process.env.NEO4J_URI as string,
//           username: process.env.NEO4J_USERNAME as string,
//           password: process.env.NEO4J_PASSWORD as string,
//           nodeLabel: "Chunk",
//           textNodeProperty: "text",
//           embeddingNodeProperty: "embedding",
//           indexName,
//         }
//       );

//       // link one chunk to the Emissionscope node (uses only nodes from screenshot + :Chunk)
//       await graph.query(
//         `
//         MATCH (c:Emissionscope)
//         WHERE coalesce(c.name, toString(c.id)) = $scopeLabel
//         MATCH (n:Chunk)
//         WHERE n.text CONTAINS $scopeLabel
//         WITH c, n LIMIT 1
//         MERGE (n)-[:MENTIONS]->(c)
//         `,
//         { scopeLabel },
//         "WRITE"
//       );
//     }
//     process.env.EMBEDDING_INDEX = indexName;

//     // init chain
//     chain = await initVectorRetrievalChain(llm, embeddings);
//   });

//   afterAll(async () => {
//     if (store) await store.close();
//     await graph.close();
//     await close();
//   });

//   it("should provide a grounded Scope-3 answer", async () => {
//     const sessionId = "scope3-vector-1";
//     const input = "[redacted]";
//     const rephrasedQuestion = "Summarize Scope 3 emissions for 2022–2023.";

//     const output = await chain.invoke(
//       { input, rephrasedQuestion },
//       { configurable: { sessionId } }
//     );

//     expect(typeof output).toBe("string");
//     expect(output.length).toBeGreaterThan(0);

//     const [row] = await graph.query<any>(
//       `
//       MATCH (s:Session {id: $sessionId})-[:LAST_RESPONSE]->(r)
//       OPTIONAL MATCH (r)-[:CONTEXT]->(x)
//       RETURN r.input AS input,
//              r.rephrasedQuestion AS rephrasedQuestion,
//              r.output AS output,
//              size([(r)-[:CONTEXT]->(n) | n]) AS contextCount
//       ORDER BY r.createdAt DESC
//       LIMIT 1
//       `,
//       { sessionId },
//       "READ"
//     );

//     expect(row).toBeDefined();
//     expect(row.input).toEqual(input);
//     expect(row.rephrasedQuestion).toEqual(rephrasedQuestion);
//     expect(row.contextCount).toBeGreaterThanOrEqual(1);
//   });
// });
