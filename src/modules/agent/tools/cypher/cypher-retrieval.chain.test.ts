// TODO: Remove code
import { ChatOpenAI } from "@langchain/openai";
import { config } from "dotenv";
import { BaseChatModel } from "langchain/chat_models/base";
import { Runnable } from "@langchain/core/runnables";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import initCypherRetrievalChain, {
  recursivelyEvaluate,
  getResults,
} from "./cypher-retrieval.chain";
import { close } from "../../../graph";

describe("Cypher QA Chain", () => {
  let graph: Neo4jGraph;
  let llm: BaseChatModel;
  let chain: Runnable;

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
      configuration: {
        baseURL: process.env.OPENAI_API_BASE,
      },
    });

    // Minimal seed so the first count test is deterministic
    await graph.query(
      `
      MERGE (:Emissionscope {id:'Efficiency', name:'Efficiency'})
      MERGE (:Emissionscope {id:'Sustainability', name:'Sustainability'})
      MERGE (:Emissionscope {id:'Asia', name:'Asia'})
      MERGE (:Emissionscope {id:'Africa', name:'Africa'})
      MERGE (:Emissionscope {id:'Global Economy', name:'Global Economy'})
      `
    );

    chain = await initCypherRetrievalChain(llm, graph);
  });

  afterAll(async () => {
    await graph.close();
    await close();
  });

  it("should answer a simple question", async () => {
    const sessionId = "cypher-retrieval-1";

    const res = (await graph.query(
      `MATCH (n:Emissionscope) WHERE n.name IS NOT NULL RETURN count(n) AS count`
    )) as { count: number }[];

    expect(res).toBeDefined();

    const output = await chain.invoke(
      {
        input: "how many are there?",
        rephrasedQuestion: "How many Emissionscope terms are in the database?",
      },
      { configurable: { sessionId } }
    );

    expect(String(output)).toContain(String(res[0].count));
  });

  it("should answer a random question", async () => {
    const sessionId = "cypher-retrieval-2";

    // Seed (analogue of the movie/person/role fixture): two chunks for Efficiency
    await graph.query(
      `
      MERGE (s:Emissionscope {id:'Efficiency'}) ON CREATE SET s.name = 'Efficiency'
      CREATE (d1:Chunk {text:'Efficiency emissions (2022): 1.2 MtCO2e.', year: 2022, value: 1.2, unit:'MtCO2e'})
      CREATE (d2:Chunk {text:'Efficiency emissions (2023): 1.3 MtCO2e.', year: 2023, value: 1.3, unit:'MtCO2e'})
      MERGE (d1)-[:HAS_ENTITY]->(s)
      MERGE (d2)-[:HAS_ENTITY]->(s)
      `
    );

    const input = "what were they in 2023?";
    const rephrasedQuestion = "What were Scope 3 Efficiency emissions in 2023?";

    const output = await chain.invoke(
      {
        input,
        rephrasedQuestion,
      },
      { configurable: { sessionId } }
    );

    expect(String(output)).toMatch(/Efficiency/i);
    expect(String(output)).toMatch(/2023/);
    expect(String(output)).toMatch(/MtCO2e/i);

    // Check persistence
    const contextRes = await graph.query(
      `
      MATCH (s:Session {id: $sessionId})-[:LAST_RESPONSE]->(r)
      RETURN
        r.input AS input,
        r.rephrasedQuestion as rephrasedQuestion,
        r.output AS output,
        [ (r)-[:CONTEXT]->(c) | elementId(c) ] AS ids
    `,
      { sessionId }
    );

    expect(contextRes).toBeDefined();
    if (contextRes) {
      const [first] = contextRes;
      expect(contextRes.length).toBe(1);

      expect(first.input).toEqual(input);
      expect(first.rephrasedQuestion).toEqual(rephrasedQuestion);
      expect(first.output).toEqual(output);
      expect(Array.isArray(first.ids)).toBe(true);
      expect(first.ids.length).toBeGreaterThan(0);
    }
  });

  it("should use elementId() to return a node ID", async () => {
    const sessionId = "cypher-retrieval-3";

    // Seed one known chunk -> Emissionscope and capture its elementId
    const seed = await graph.query(
      `
      MATCH (d:Chunk)-[:HAS_ENTITY]->(:Emissionscope {id:'Efficiency'})
      RETURN elementId(d) AS _id, d.text AS text
      ORDER BY toInteger(split(elementId(d),':')[2]) DESC
      LIMIT 1
   `
    );

    const output = await chain.invoke(
      {
        input: "what do the documents say?",
        rephrasedQuestion: "List text chunks that mention Efficiency.",
      },
      { configurable: { sessionId } }
    );

    expect(String(output)).toMatch(/Efficiency/i);

    // Saved context should include the seeded Chunk id
    const contextRes = await graph.query(
      `
      MATCH (s:Session {id: $sessionId})-[:LAST_RESPONSE]->(r)
      RETURN [ (r)-[:CONTEXT]->(c) | elementId(c) ] AS ids
      `,
      { sessionId }
    );

    expect(contextRes).toBeDefined();
    if (contextRes) {
      expect(contextRes.length).toBe(1);

      const contextIds = (contextRes[0].ids as string[]).join(",");
      const seedIds = seed?.map((el: any) => el._id as string) ?? [];
      for (const id in seedIds) {
        expect(contextIds).toContain(id);
      }
    }
  });

  describe("recursivelyEvaluate", () => {
    it("should correct a query with a missing variable", async () => {
      const res = await recursivelyEvaluate(
        graph,
        llm,
        "List text chunks that mention the Emissionscope 'Efficiency'."
      );

      expect(res).toBeDefined();
    });
  });

  describe("getResults", () => {
    it("should fix a broken Cypher statement on the fly", async () => {
      const res = await getResults(graph, llm, {
        question:
          "Return chunks that mention the Emissionscope 'Efficiency' with identifiers.",
        cypher:
          "MATCH (d:Chunk)-[:HAS_ENTITY]->(c:Emissionscope {id:'Efficiency'}) " +
          "RETURN d.text AS text, r.role AS Role, elementId(d) AS _id LIMIT 10",
      });

      expect(res).toBeDefined();
      expect(JSON.stringify(res).toLowerCase()).toContain("mtco2e");
    });
  });
});
