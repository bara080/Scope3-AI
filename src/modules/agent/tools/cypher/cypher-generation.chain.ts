import { BaseLanguageModel } from "langchain/base_language";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";

type Input = { question: string };

export default async function initCypherGenerationChain(
  graph: Neo4jGraph,
  llm: BaseLanguageModel
): Promise<RunnableSequence<Input, string>> {
  const cypherPrompt = PromptTemplate.fromTemplate(
    `You are an expert in Neo4j Cypher.
Generate a single valid Cypher query for the question using the provided graph schema.

Rules:
- Use labels/relationship types exactly as shown in the schema.
- Prefer elementId(n) over id(n).
- Return only the Cypher query, no explanation or markdown fences.

Schema:
{schema}

Question:
{question}

Cypher:`
  );

  const chain = RunnableSequence.from<Input, string>([
    // Keep incoming {question} and add live schema
    new RunnablePassthrough().assign({
      schema: async () => await graph.getSchema(),
    }),
    cypherPrompt,
    llm,
    new StringOutputParser(),
  ]);

  return chain;
}
