import { BaseLanguageModel } from "langchain/base_language";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { JsonOutputParser } from "@langchain/core/output_parsers";

// tag::interface[]
export type CypherEvaluationChainInput = {
  question: string;
  cypher: string;
  schema: string;
  errors: string[] | string | undefined;
};
// end::interface[]

// tag::output[]
export type CypherEvaluationChainOutput = {
  cypher: string;
  errors: string[];
};
// end::output[]

// tag::function[]
export default async function initCypherEvaluationChain(
  llm: BaseLanguageModel
): Promise<
  RunnableSequence<CypherEvaluationChainInput, CypherEvaluationChainOutput>
> {
  const prompt = PromptTemplate.fromTemplate(
    `You are a Neo4j Cypher expert. Given a graph schema, a user question, a Cypher query,
and any database error messages, produce a corrected Cypher query if needed.

Rules:
- Use labels, relationship types, and properties exactly as defined in the schema.
- Prefer elementId(n) over id(n).
- Do NOT include explanations—return ONLY valid JSON.
- If the input Cypher is valid, return it unchanged.
- If you cannot correct it, return the original Cypher and include at least one error describing why.

Return JSON:
{{
  "cypher": "<corrected or original cypher>",
  "errors": ["<empty if none, else list of issues>"]
}}

Schema:
{schema}

Question:
{question}

Current Cypher:
{cypher}

Errors (if any):
{errors}

JSON:`
  );

  return RunnableSequence.from<
    CypherEvaluationChainInput,
    CypherEvaluationChainOutput
  >([
    new RunnablePassthrough(),
    prompt,
    llm,
    new JsonOutputParser<CypherEvaluationChainOutput>(),
  ]);
}
// end::function[]
