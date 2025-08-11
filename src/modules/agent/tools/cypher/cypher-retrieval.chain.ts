import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { RunnablePassthrough } from "@langchain/core/runnables";
import { BaseLanguageModel } from "@langchain/core/language_models/base";

import initCypherGenerationChain from "./cypher-generation.chain";
import initCypherEvaluationChain from "./cypher-evaluation.chain";
import initGenerateAuthoritativeAnswerChain from "../../chains/authoritative-answer-generation.chain";

import { saveHistory } from "../../history";
import { AgentToolInput } from "../../agent.types";
import { extractIds } from "../../../../utils";

type CypherRetrievalThroughput = AgentToolInput & {
  context: string;
  output: string;
  cypher: string;
  results: Record<string, any> | Record<string, any>[];
  ids: string[];
};
// add near the top (after imports)
type SaveHistoryFn = (
  question: string,
  cypher: string,
  output: string,
  ids: string[],
  results: Record<string, any>[],
  context: string,
  sessionId?: string
) => unknown;
const saveHistoryTyped = saveHistory as unknown as SaveHistoryFn;

export async function recursivelyEvaluate(
  graph: Neo4jGraph,
  llm: BaseLanguageModel,
  question: string
): Promise<string> {
  const generation = await initCypherGenerationChain(graph, llm);
  const evaluator = await initCypherEvaluationChain(llm);

  let cypher = await generation.invoke({ question });

  for (let i = 0; i < 5; i++) {
    try {
      await graph.query(cypher);
      return cypher;
    } catch (e: any) {
      // quick fix for common misuse
      cypher = cypher.replace(/\sid\(([^)]+)\)/g, " elementId($1)");
      const schema = await graph.getSchema();
      const { cypher: fixed } = await evaluator.invoke({
        question,
        cypher,
        schema,
        errors: e?.message ?? String(e),
      });
      cypher = fixed ?? cypher;
    }
  }

  return cypher;
}

export async function getResults(
  graph: Neo4jGraph,
  llm: BaseLanguageModel,
  input: { question: string; cypher: string }
): Promise<Record<string, any>[] | undefined> {
  try {
    return await graph.query(input.cypher);
  } catch (e: any) {
    const evaluator = await initCypherEvaluationChain(llm);
    const schema = await graph.getSchema();
    const { cypher: fixed } = await evaluator.invoke({
      question: input.question,
      cypher: input.cypher,
      schema,
      errors: e?.message ?? String(e),
    });
    return await graph.query(fixed ?? input.cypher);
  }
}

export default async function initCypherRetrievalChain(
  llm: BaseLanguageModel,
  graph: Neo4jGraph
): Promise<any> {
  const answer = initGenerateAuthoritativeAnswerChain(llm);

  return new RunnablePassthrough()
    .assign({
      cypher: async (input: AgentToolInput) =>
        recursivelyEvaluate(graph, llm, input.input),
    })
    .assign({
      results: async (prev: CypherRetrievalThroughput) =>
        getResults(graph, llm, {
          question: prev.input,
          cypher: prev.cypher,
        }),
    })
    .assign({
      ids: (prev: CypherRetrievalThroughput) => extractIds(prev.results),
      context: (prev: CypherRetrievalThroughput) =>
        JSON.stringify(prev.results, null, 2),
    })
    .assign({
      output: (prev: CypherRetrievalThroughput) =>
        answer.invoke({ question: prev.input, context: prev.context }),
    })
    .assign({
      history: (prev: CypherRetrievalThroughput) => {
        const ids: string[] = Array.isArray(prev.ids)
          ? prev.ids.map(String)
          : [];

        const results: Record<string, any>[] = Array.isArray(prev.results)
          ? prev.results
          : [prev.results];

        return saveHistoryTyped(
          prev.input, // question
          prev.cypher, // cypher
          prev.output, // answer text
          ids, // string[]
          results, // Record<string, any>[]
          prev.context // context string
          // optional 7th: sessionId
        );
      },
    });
}
