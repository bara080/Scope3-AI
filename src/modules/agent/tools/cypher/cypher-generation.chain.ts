import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { BaseLanguageModel } from "langchain/base_language";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  RunnableSequence,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

export default async function initCypherGenerationChain(
  graph: Neo4jGraph,
  llm: BaseLanguageModel
) {
  // NOTE: avoid unescaped { } in examples to prevent PromptTemplate errors
  const cypherPrompt = PromptTemplate.fromTemplate(`
You are a Neo4j Developer translating user questions into Cypher to answer questions about Scope 3 emissions.

Convert the user's question into a Cypher statement based on the schema.

You must:
* Only use the nodes, relationships, and properties in the schema.
  (Examples of labels you may see: Emissionscope, Chunk, Document, Stakeholder, Response, Session, etc.)
* When checking property existence, use IS NOT NULL (not exists()).
* Always return a stable identifier with elementId() as _id.
* Include helpful fields when present (e.g., scope name, stakeholder name/id, year, value, unit, and any text/source on :Chunk/:Document like text, summary, url, source).
* Limit results to 10.
* Respond with only a Cypher statement. No preamble.

Example (structure only):
MATCH (c:Emissionscope)
WHERE c.name = 'Efficiency'
RETURN c.name AS scope, elementId(c) AS _id
LIMIT 10

Schema:
{schema}

Question:
{question}
  `);

  return RunnableSequence.from<string, string>([
    {
      question: new RunnablePassthrough(),
      schema: () => graph.getSchema(),
    },
    cypherPrompt,
    llm,
    new StringOutputParser(),
  ]);
}

// import { BaseLanguageModel } from "langchain/base_language";
// import { PromptTemplate } from "@langchain/core/prompts";
// import {
//   RunnablePassthrough,
//   RunnableSequence,
// } from "@langchain/core/runnables";
// import { StringOutputParser } from "@langchain/core/output_parsers";
// import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";

// type Input = { question: string };

// export default async function initCypherGenerationChain(
//   graph: Neo4jGraph,
//   llm: BaseLanguageModel
// ): Promise<RunnableSequence<Input, string>> {
//   const cypherPrompt = PromptTemplate.fromTemplate(
//     `You are an expert in Neo4j Cypher.
// Generate a single valid Cypher query for the question using the provided graph schema.

// Rules:
// - Use labels/relationship types exactly as shown in the schema.
// - Prefer elementId(n) over id(n).
// - Return only the Cypher query, no explanation or markdown fences.

// Schema:
// {schema}

// Question:
// {question}

// Cypher:`
//   );

//   const chain = RunnableSequence.from<Input, string>([
//     // Keep incoming {question} and add live schema
//     new RunnablePassthrough().assign({
//       schema: async () => await graph.getSchema(),
//     }),
//     cypherPrompt,
//     llm,
//     new StringOutputParser(),
//   ]);

//   return chain;
// }
