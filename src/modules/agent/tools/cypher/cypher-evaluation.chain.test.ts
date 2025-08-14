import { ChatOpenAI } from "@langchain/openai";
import { config } from "dotenv";
import { BaseChatModel } from "langchain/chat_models/base";
import { RunnableSequence } from "@langchain/core/runnables";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import initCypherEvaluationChain from "./cypher-evaluation.chain";

describe("Cypher Evaluation Chain (Scope 3)", () => {
  let graph: Neo4jGraph;
  let llm: BaseChatModel;
  let chain: RunnableSequence;

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

    chain = await initCypherEvaluationChain(llm);
  });

  afterAll(async () => {
    await graph.close();
  });

  it("should fix a non-existent label", async () => {
    const input = {
      question: "How many Emissionscope terms are in the database?",
      cypher: "MATCH (c:ScopeTerm) RETURN count(c) AS count",
      schema: graph.getSchema(),
      errors: ["Label ScopeTerm does not exist"],
    };

    const { cypher, errors } = await chain.invoke(input);

    expect(cypher).toMatch(/MATCH\s*\(.*:Emissionscope\)/i);
    expect(cypher.toLowerCase()).toContain("return");
    expect(cypher.toLowerCase()).toContain("count(");

    expect(errors.length).toBeGreaterThanOrEqual(1);
    const found = errors.some((e: string) =>
      String(e).toLowerCase().includes("scopeterm")
    );
    expect(found).toBe(true);
  });

  it("should fix a non-existent relationship", async () => {
    const input = {
      question: "List text chunks that mention the Emissionscope 'Efficiency'.",
      cypher:
        "MATCH (d:Chunk)-[:REFERS_TO]->(c:ScopeTerm {name:'Efficiency'}) RETURN d.text",
      schema: graph.getSchema(),
      errors: [
        "Label ScopeTerm does not exist",
        "Relationship type REFERS_TO does not exist",
      ],
    };

    const { cypher, errors } = await chain.invoke(input);

    expect(cypher).toMatch(/MATCH\s*\(.*:Chunk\)/i);
    expect(cypher).toMatch(/:Emissionscope/i);
    // Accept either of the schema relationships used in your data
    expect(cypher).toMatch(/:(MENTIONS|HAS_ENTITY)/i);
    expect(cypher.toLowerCase()).toContain("return");
    expect(cypher.toLowerCase()).toContain("elementid(");
    expect(cypher.toLowerCase()).toContain("limit 10");

    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("should return no errors if the query is fine", async () => {
    const cypher = "MATCH (c:Emissionscope) RETURN count(c) AS count";
    const input = {
      question: "How many Emissionscope terms are in the database?",
      cypher,
      schema: graph.getSchema(),
      errors: [],
    };

    const { cypher: updatedCypher, errors } = await chain.invoke(input);

    // Allow evaluator to add safe guards like WHERE c.name IS NOT NULL
    expect(updatedCypher).toMatch(/MATCH\s*\(.*:Emissionscope\)/i);
    expect(updatedCypher.toLowerCase()).toContain("return count(c) as count");
    expect(errors.length).toBe(0);
  });

  it("should keep variables in relationship", async () => {
    const cypher =
      "MATCH (d:Chunk)-[r:MENTIONS]->(c:Emissionscope {name:'Efficiency'}) RETURN r";
    const input = {
      question:
        "Return the relationship that links a chunk to the Emissionscope 'Efficiency'.",
      cypher,
      schema: graph.getSchema(),
      errors: [],
    };

    const { cypher: updatedCypher, errors } = await chain.invoke(input);

    // Keep the relationship variable; accept either MENTIONS or HAS_ENTITY
    expect(updatedCypher).toMatch(/\[r:/);
    expect(updatedCypher).toMatch(/:(MENTIONS|HAS_ENTITY)/i);
    expect(errors.length).toBe(0);
  });
});

// import { ChatOpenAI } from "@langchain/openai";
// import { config } from "dotenv";
// import { BaseChatModel } from "langchain/chat_models/base";
// import { RunnableSequence } from "@langchain/core/runnables";
// import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
// import initCypherEvaluationChain from "./cypher-evaluation.chain";

// describe("Cypher Evaluation Chain", () => {
//   let graph: Neo4jGraph;
//   let llm: BaseChatModel;
//   let chain: RunnableSequence;

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
//       configuration: {
//         baseURL: process.env.OPENAI_API_BASE,
//       },
//     });

//     chain = await initCypherEvaluationChain(llm);
//   });

//   afterAll(async () => {
//     await graph.close();
//   });

//   it("should fix a non-existent label", async () => {
//     const input = {
//       question: "How many movies are in the database?",
//       cypher: "MATCH (m:Muvee) RETURN count(m) AS count",
//       schema: graph.getSchema(),
//       errors: ["Label Muvee does not exist"],
//     };

//     const { cypher, errors } = await chain.invoke(input);

//     expect(cypher).toContain("MATCH (m:Movie) RETURN count(m) AS count");

//     expect(errors.length).toBe(1);

//     let found = false;

//     for (const error of errors) {
//       if (error.includes("label Muvee does not exist")) {
//         found = true;
//       }
//     }

//     expect(found).toBe(true);
//   });

//   it("should fix a non-existent relationship", async () => {
//     const input = {
//       question: "Who acted in the matrix?",
//       cypher:
//         'MATCH (m:Muvee)-[:ACTS_IN]->(a:Person) WHERE m.name = "The Matrix" RETURN a.name AS actor',
//       schema: graph.getSchema(),
//       errors: [
//         "Label Muvee does not exist",
//         "Relationship type ACTS_IN does not exist",
//       ],
//     };

//     const { cypher, errors } = await chain.invoke(input);

//     expect(cypher).toContain("MATCH (m:Movie");
//     expect(cypher).toContain(":ACTED_IN");

//     expect(errors.length).toBeGreaterThanOrEqual(2);

//     let found = false;

//     for (const error of errors) {
//       if (error.includes("ACTS_IN")) {
//         found = true;
//       }
//     }

//     expect(found).toBe(true);
//   });

//   it("should return no errors if the query is fine", async () => {
//     const cypher = "MATCH (m:Movie) RETURN count(m) AS count";
//     const input = {
//       question: "How many movies are in the database?",
//       cypher,
//       schema: graph.getSchema(),
//       errors: ["Label Muvee does not exist"],
//     };

//     const { cypher: updatedCypher, errors } = await chain.invoke(input);

//     expect(updatedCypher).toContain(cypher);
//     expect(errors.length).toBe(0);
//   });

//   it("should keep variables in relationship", async () => {
//     const cypher =
//       "MATCH (a:Actor {name: 'Emil Eifrem'})-[r:ACTED_IN]->" +
//       "(m:Movie {title: 'Neo4j - Into the Graph'}) RETURN r.role AS Role";
//     const input = {
//       question: "What role did Emil Eifrem play in Neo4j - Into the Graph",
//       cypher,
//       schema: graph.getSchema(),
//       errors: [],
//     };

//     const { cypher: updatedCypher, errors } = await chain.invoke(input);

//     expect(updatedCypher).toContain(cypher);
//     expect(errors.length).toBe(0);
//   });
// });
