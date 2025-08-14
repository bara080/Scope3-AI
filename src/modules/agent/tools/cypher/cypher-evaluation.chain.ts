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
export default async function initCypherEvaluationChain(
  llm: BaseLanguageModel
) {
  // Prompt template (Scope 3 emissions)
  const prompt = PromptTemplate.fromTemplate(`
    You are an expert Neo4j Developer evaluating a Cypher statement written by an AI for Scope 3 emissions use cases.

    Check the Cypher against the database schema to ensure it answers the user's question. Fix errors where possible.

    The query must:
    * Only use the nodes, relationships, and properties mentioned in the schema.
    * Assign a variable to nodes or relationships when accessing their properties.
    * Use IS NOT NULL to check for property existence (do not use exists()).
    * Use the elementId() function to return a unique identifier as _id.
    * Include helpful fields when present (e.g., Emissionscope name, stakeholder, year, value, unit, and any text/summary/url/source on Chunk/Document).
    * Limit the maximum number of results to 10.
    * Respond with only a Cypher statement. No preamble.

    Respond with a JSON object with "cypher", "corrected", and "errors" keys.
      * "cypher"    - the corrected Cypher statement
      * "corrected" - boolean indicating if a correction was applied
      * "errors"    - list of uncorrectable errors (e.g., missing labels/properties); include a hint if possible

    Fixable Example (structure only):
    // input:
    // MATCH (d:Chunk)-[:MENTIONS]->(c:Emissionscope) RETURN d.text
    // fixed:
    // MATCH (d:Chunk)-[:MENTIONS]->(c:Emissionscope)
    // WHERE d.text IS NOT NULL
    // RETURN d.text AS text, elementId(d) AS _id
    // LIMIT 10

    Schema:
    {schema}

    Question:
    {question}

    Cypher Statement:
    {cypher}

    {errors}
  `);

  return RunnableSequence.from<
    CypherEvaluationChainInput,
    CypherEvaluationChainOutput
  >([
    RunnablePassthrough.assign({
      // Convert errors into an LLM-friendly list
      errors: ({ errors }) => {
        if (!errors || (Array.isArray(errors) && errors.length === 0))
          return "";
        return `Errors: * ${
          Array.isArray(errors) ? errors.join("\n* ") : errors
        }`;
      },
    }),
    prompt,
    llm,
    new JsonOutputParser<CypherEvaluationChainOutput>(),
  ]);
}

// tag::function[]
// export default async function initCypherEvaluationChain(
//   llm: BaseLanguageModel
// ): Promise<
//   RunnableSequence<CypherEvaluationChainInput, CypherEvaluationChainOutput>
// > {
//   const prompt = PromptTemplate.fromTemplate(
//     `You are a Neo4j Cypher expert. Given a graph schema, a user question, a Cypher query,
// and any database error messages, produce a corrected Cypher query if needed.

// Rules:
// - Use labels, relationship types, and properties exactly as defined in the schema.
// - Prefer elementId(n) over id(n).
// - Do NOT include explanations—return ONLY valid JSON.
// - If the input Cypher is valid, return it unchanged.
// - If you cannot correct it, return the original Cypher and include at least one error describing why.

// Return JSON:
// {{
//   "cypher": "<corrected or original cypher>",
//   "errors": ["<empty if none, else list of issues>"]
// }}

// Schema:
// {schema}

// Question:
// {question}

// Current Cypher:
// {cypher}

// Errors (if any):
// {errors}

// JSON:`
//   );

//   return RunnableSequence.from<
//     CypherEvaluationChainInput,
//     CypherEvaluationChainOutput
//   >([
//     new RunnablePassthrough(),
//     prompt,
//     llm,
//     new JsonOutputParser<CypherEvaluationChainOutput>(),
//   ]);
// }
// end::function[]
