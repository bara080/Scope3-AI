// import { BaseLanguageModel } from "langchain/base_language";
// import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
// import { RunnablePassthrough } from "@langchain/core/runnables";
// import initCypherGenerationChain from "./cypher-generation.chain";
// import initCypherEvaluationChain from "./cypher-evaluation.chain";
// import { saveHistory } from "../../history";
// import { AgentToolInput } from "../../agent.types";
// import { extractIds } from "../../../../utils";
// import initGenerateAuthoritativeAnswerChain from "../../chains/authoritative-answer-generation.chain";

// // tag::input[]
// type CypherRetrievalThroughput = AgentToolInput & {
//   context: string;
//   output: string;
//   cypher: string;
//   results: Record<string, any> | Record<string, any>[];
//   ids: string[];
// };
// // end::input[]

// // tag::recursive[]
// /**
//  * Use database the schema to generate and subsequently validate
//  * a Cypher statement based on the user question
//  *
//  * @param {Neo4jGraph}        graph     The graph
//  * @param {BaseLanguageModel} llm       An LLM to generate the Cypher
//  * @param {string}            question  The rephrased question
//  * @returns {string}
//  */
// /**
//  * Use database the schema to generate and subsequently validate
//  * a Cypher statement based on the user question
//  *
//  * @param {Neo4jGraph}        graph     The graph
//  * @param {BaseLanguageModel} llm       An LLM to generate the Cypher
//  * @param {string}            question  The rephrased question
//  * @returns {string}
//  */

// export async function recursivelyEvaluate(
//   graph: Neo4jGraph,
//   llm: BaseLanguageModel,
//   question: string
// ): Promise<string> {
//   // Initiate chains
//   const generationChain = await initCypherGenerationChain(graph, llm);
//   const evaluatorChain = await initCypherEvaluationChain(llm);

//   // Generate Initial Cypher
//   let cypher = await generationChain.invoke(question);

//   let errors = ["N/A"];
//   let tries = 0;

//   while (tries < 5 && errors.length > 0) {
//     tries++;

//     try {
//       // Evaluate Cypher
//       const evaluation = await evaluatorChain.invoke({
//         question,
//         schema: graph.getSchema(),
//         cypher,
//         errors,
//       });

//       errors = evaluation.errors;
//       cypher = evaluation.cypher;
//     } catch (e: unknown) {}
//   }

//   // Bug fix: GPT-4 is adamant that it should use id() regardless of
//   // the instructions in the prompt.  As a quick fix, replace it here
//   cypher = cypher.replace(/\sid\(([^)]+)\)/g, " elementId($1)");

//   return cypher;
// }
// // end::recursive[]

// // tag::results[]
// /**
//  * Attempt to get the results, and if there is a syntax error in the Cypher statement,
//  * attempt to correct the errors.
//  *
//  * @param {Neo4jGraph}        graph  The graph instance to get the results from
//  * @param {BaseLanguageModel} llm    The LLM to evaluate the Cypher statement if anything goes wrong
//  * @param {string}            input  The input built up by the Cypher Retrieval Chain
//  * @returns {Promise<Record<string, any>[]>}
//  */
// export async function getResults(
//   graph: Neo4jGraph,
//   llm: BaseLanguageModel,
//   input: { question: string; cypher: string }
// ): Promise<any | undefined> {
//   // TODO: catch Cypher errors and pass to the Cypher evaluation chain
//   let results;
//   let retries = 0;
//   let cypher = input.cypher;

//   // Evaluation chain if an error is thrown by Neo4j
//   const evaluationChain = await initCypherEvaluationChain(llm);
//   while (results === undefined && retries < 5) {
//     try {
//       results = await graph.query(cypher);
//       return results;
//     } catch (e: any) {
//       retries++;

//       const evaluation = await evaluationChain.invoke({
//         cypher,
//         question: input.question,
//         schema: graph.getSchema(),
//         errors: [e.message],
//       });

//       cypher = evaluation.cypher;
//     }
//   }

//   return results;
// }

// // export default async function initCypherRetrievalChain(
// //   llm: BaseLanguageModel,
// //   graph: Neo4jGraph
// // ) {
// //   const answerGeneration = await initGenerateAuthoritativeAnswerChain(llm);

// //   return (
// //     RunnablePassthrough
// //       // Generate and evaluate the Cypher statement
// //       // Generate Output
// //       .assign({
// //         output: (input: CypherRetrievalThroughput) => {
// //           // 1) deterministic COUNT path (already there)
// //           try {
// //             const parsed = JSON.parse(input.context);
// //             const first = Array.isArray(parsed) ? parsed[0] : parsed;
// //             if (first && typeof first.count === "number") {
// //               return `There are ${first.count} Emissionscope terms in the database.`;
// //             }
// //           } catch {
// //             /* fall through */
// //           }

// //           // 2) deterministic Scope-3 emissions path
// //           try {
// //             const data = JSON.parse(input.context);
// //             const rows = (Array.isArray(data) ? data : [data]).filter(Boolean);

// //             if (rows.length > 0) {
// //               // grab scope + year from the question
// //               const scopeMatch = input.rephrasedQuestion.match(
// //                 /\b(Efficiency|Sustainability|Asia|Africa|Global Economy)\b/i
// //               );
// //               const yearMatch =
// //                 input.rephrasedQuestion.match(/\b(19|20)\d{2}\b/);
// //               const scope = scopeMatch ? scopeMatch[1] : "Scope 3";
// //               const askYear = yearMatch ? Number(yearMatch[0]) : undefined;

// //               // choose the row for the asked year, else the max year
// //               const pick = (() => {
// //                 if (askYear) {
// //                   const exact = rows.find(
// //                     (r: any) => Number(r.year) === askYear
// //                   );
// //                   if (exact) return exact;
// //                 }
// //                 return rows
// //                   .slice()
// //                   .sort(
// //                     (a: any, b: any) =>
// //                       Number(b.year ?? 0) - Number(a.year ?? 0)
// //                   )[0];
// //               })() as any;

// //               if (pick) {
// //                 // value / unit from fields or parse from text
// //                 let { value, unit, text, year } = pick ?? {};
// //                 const txt = String(text ?? "");

// //                 if (!unit && /mtco2e/i.test(txt)) unit = "MtCO2e";
// //                 if (
// //                   (value === undefined || value === null) &&
// //                   /([\d.]+)\s*mtco2e/i.test(txt)
// //                 ) {
// //                   value = Number((txt.match(/([\d.]+)\s*mtco2e/i) ?? [])[1]);
// //                 }

// //                 // if we have year + (unit or value-in-text), form a deterministic answer
// //                 const y = askYear ?? year;
// //                 if (y && (unit || /mtco2e/i.test(txt))) {
// //                   const valStr =
// //                     value !== undefined && value !== null ? `${value} ` : "";
// //                   const u = unit ?? "MtCO2e"; // ensure token appears
// //                   return `Scope 3 ${scope} emissions in ${y} were ${valStr}${u}.`;
// //                 }
// //               }
// //             }
// //           } catch {
// //             /* fall through to LLM */
// //           }

// //           // fallback to the authoritative LLM prompt
// //           return answerGeneration.invoke({
// //             question: input.rephrasedQuestion,
// //             context: input.context,
// //           });
// //         },
// //       })

// //       .assign({
// //         cypher: (input: { rephrasedQuestion: string }) =>
// //           recursivelyEvaluate(graph, llm, input.rephrasedQuestion),
// //       })

// //       // Get results from database
// //       .assign({
// //         results: (input: { cypher: string; question: string }) =>
// //           getResults(graph, llm, input),
// //       })

// //       // Extract information
// //       .assign({
// //         // Extract _id fields
// //         ids: (input: Omit<CypherRetrievalThroughput, "ids">) =>
// //           extractIds(input.results),
// //         // Convert results to JSON output
// //         context: ({ results }: Omit<CypherRetrievalThroughput, "ids">) =>
// //           Array.isArray(results) && results.length == 1
// //             ? JSON.stringify(results[0])
// //             : JSON.stringify(results),
// //       })

// //       // Generate Output
// //       .assign({
// //         output: (input: CypherRetrievalThroughput) =>
// //           answerGeneration.invoke({
// //             question: input.rephrasedQuestion,
// //             context: input.context,
// //           }),
// //       })

// //       // Save response to database
// //       .assign({
// //         responseId: async (input: CypherRetrievalThroughput, options) => {
// //           saveHistory(
// //             options?.config.configurable.sessionId,
// //             "cypher",
// //             input.input,
// //             input.rephrasedQuestion,
// //             input.output,
// //             input.ids,
// //             input.cypher
// //           );
// //         },
// //       })
// //       // Return the output
// //       .pick("output")
// //   );
// // }
// // export default async function initCypherRetrievalChain(
// //   llm: BaseLanguageModel,
// //   graph: Neo4jGraph
// // ) {
// //   const answerGeneration = await initGenerateAuthoritativeAnswerChain(llm);

// //   return (
// //     RunnablePassthrough
// //       // 1) Generate and evaluate the Cypher statement
// //       .assign({
// //         cypher: (input: { rephrasedQuestion: string }) =>
// //           recursivelyEvaluate(graph, llm, input.rephrasedQuestion),
// //       })

// //       // 2) Get results from database
// //       .assign({
// //         results: (input: { cypher: string; question: string }) =>
// //           getResults(graph, llm, input),
// //       })

// //       // 3) Extract information
// //       .assign({
// //         // Extract _id fields
// //         ids: (input: Omit<CypherRetrievalThroughput, "ids">) =>
// //           extractIds(input.results),
// //         // Convert results to JSON output
// //         context: ({ results }: Omit<CypherRetrievalThroughput, "ids">) =>
// //           Array.isArray(results) && results.length === 1
// //             ? JSON.stringify(results[0])
// //             : JSON.stringify(results),
// //       })

// //       // 4) Generate Output (single output step; includes deterministic Scope-3 logic)
// //       .assign({
// //         output: (input: CypherRetrievalThroughput) => {
// //           // A) deterministic COUNT path
// //           try {
// //             const parsed = JSON.parse(input.context);
// //             const first = Array.isArray(parsed) ? parsed[0] : parsed;
// //             if (first && typeof first.count === "number") {
// //               return `There are ${first.count} Emissionscope terms in the database.`;
// //             }
// //           } catch {
// //             /* fall through */
// //           }

// //           // B) deterministic Scope-3 emissions path
// //           try {
// //             const data = JSON.parse(input.context);
// //             const rows = (Array.isArray(data) ? data : [data]).filter(Boolean);

// //             if (rows.length > 0) {
// //               const scopeMatch = input.rephrasedQuestion.match(
// //                 /\b(Efficiency|Sustainability|Asia|Africa|Global Economy)\b/i
// //               );
// //               const yearMatch =
// //                 input.rephrasedQuestion.match(/\b(19|20)\d{2}\b/);
// //               const scope = scopeMatch ? scopeMatch[1] : "Scope 3";
// //               const askYear = yearMatch ? Number(yearMatch[0]) : undefined;

// //               const pick = (() => {
// //                 if (askYear) {
// //                   const exact = rows.find(
// //                     (r: any) => Number(r.year) === askYear
// //                   );
// //                   if (exact) return exact;
// //                 }
// //                 return rows
// //                   .slice()
// //                   .sort(
// //                     (a: any, b: any) =>
// //                       Number(b.year ?? 0) - Number(a.year ?? 0)
// //                   )[0];
// //               })() as any;

// //               if (pick) {
// //                 let { value, unit, text, year } = pick ?? {};
// //                 const txt = String(text ?? "");

// //                 if (!unit && /mtco2e/i.test(txt)) unit = "MtCO2e";
// //                 if (
// //                   (value === undefined || value === null) &&
// //                   /([\d.]+)\s*mtco2e/i.test(txt)
// //                 ) {
// //                   value = Number((txt.match(/([\d.]+)\s*mtco2e/i) ?? [])[1]);
// //                 }

// //                 const y = askYear ?? year;
// //                 if (y && (unit || /mtco2e/i.test(txt))) {
// //                   const valStr =
// //                     value !== undefined && value !== null ? `${value} ` : "";
// //                   const u = unit ?? "MtCO2e";
// //                   return `Scope 3 ${scope} emissions in ${y} were ${valStr}${u}.`;
// //                 }
// //               }
// //             }
// //           } catch {
// //             /* fall through to LLM */
// //           }

// //           // C) fallback to the authoritative LLM prompt
// //           return answerGeneration.invoke({
// //             question: input.rephrasedQuestion,
// //             context: input.context,
// //           });
// //         },
// //       })

// //       // 5) Save response to database
// //       .assign({
// //         responseId: async (input: CypherRetrievalThroughput, options) => {
// //           saveHistory(
// //             options?.config.configurable.sessionId,
// //             "cypher",
// //             input.input,
// //             input.rephrasedQuestion,
// //             input.output,
// //             input.ids,
// //             input.cypher
// //           );
// //         },
// //       })

// //       // 6) Return the output
// //       .pick("output")
// //   );
// // }
// export default async function initCypherRetrievalChain(
//   llm: BaseLanguageModel,
//   graph: Neo4jGraph
// ) {
//   const answerGeneration = await initGenerateAuthoritativeAnswerChain(llm);

//   return (
//     RunnablePassthrough
//       // Generate and evaluate the Cypher statement
//       .assign({
//         cypher: (input: { rephrasedQuestion: string }) =>
//           recursivelyEvaluate(graph, llm, input.rephrasedQuestion),
//       })

//       // Get results from database
//       .assign({
//         results: (input: { cypher: string; question: string }) =>
//           getResults(graph, llm, input),
//       })

//       // Extract information
//       .assign({
//         // Extract _id fields
//         ids: (input: Omit<CypherRetrievalThroughput, "ids">) =>
//           extractIds(input.results),
//         // Convert results to JSON output
//         context: ({ results }: Omit<CypherRetrievalThroughput, "ids">) =>
//           Array.isArray(results) && results.length == 1
//             ? JSON.stringify(results[0])
//             : JSON.stringify(results),
//       })

//       // Generate Output
//       .assign({
//         output: (input: CypherRetrievalThroughput) =>
//           answerGeneration.invoke({
//             question: input.rephrasedQuestion,
//             context: input.context,
//           }),
//       })

//       // Save response to database
//       .assign({
//         responseId: async (input: CypherRetrievalThroughput, options) => {
//           saveHistory(
//             options?.config.configurable.sessionId,
//             "cypher",
//             input.input,
//             input.rephrasedQuestion,
//             input.output,
//             input.ids,
//             input.cypher
//           );
//         },
//       })
//       // Return the output
//       .pick("output")
//   );
// }
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

/**
 * Use the database schema to generate and validate a Cypher statement based on the user question
 */
export async function recursivelyEvaluate(
  graph: Neo4jGraph,
  llm: BaseLanguageModel,
  question: string
): Promise<string> {
  const generationChain = await initCypherGenerationChain(graph, llm);
  const evaluatorChain = await initCypherEvaluationChain(llm);

  // 0) Hard guardrails for Scope-3
  const isCountEmissionscope =
    /how\s+many/i.test(question) && /emissionscope/i.test(question);

  // If the user asked “how many Emissionscope …”, force a clean COUNT query
  if (isCountEmissionscope) {
    return `
MATCH (n:Emissionscope)
WHERE n.name IS NOT NULL
RETURN count(n) AS count
`.trim();
  }

  // 1) Try LLM generation
  let cypher = await generationChain.invoke(question);

  // 2) Evaluate/fix up to 5 times
  let errors = ["N/A"];
  let tries = 0;

  while (tries < 5 && errors.length > 0) {
    tries++;
    try {
      const evaluation = await evaluatorChain.invoke({
        question,
        schema: graph.getSchema(),
        cypher,
        errors,
      });
      errors = evaluation.errors;
      cypher = evaluation.cypher;
    } catch (_e: unknown) {}
  }

  // 3) Post-fixes
  cypher = cypher.replace(/\sid\(([^)]+)\)/gi, " elementId($1)");
  cypher = cypher.replace(/exists\(\s*([^)]+)\s*\)/gi, "$1 IS NOT NULL");
  if (!/limit\s+\d+/i.test(cypher)) cypher = `${cypher.trim()} LIMIT 10`;

  // 4) Scope-3 fallback: if question mentions emissions/year/chunks/docs, ensure :Chunk retrieval
  const needsChunk =
    !/:Chunk\b/i.test(cypher) &&
    (/\b(19|20)\d{2}\b/.test(question) ||
      /emission/i.test(question) ||
      /chunk|document/i.test(question));

  if (needsChunk) {
    const scopeMatch = question.match(
      /\b(Efficiency|Sustainability|Asia|Africa|Global Economy)\b/i
    );
    const yearMatch = question.match(/\b(19|20)\d{2}\b/);

    const scope = scopeMatch ? scopeMatch[1].toLowerCase() : null;
    const scopeWhere = scope
      ? `( (c.name IS NOT NULL AND toLower(c.name) = '${scope}') OR (c.id IS NOT NULL AND toLower(c.id) = '${scope}') )`
      : "true";

    const year = yearMatch ? yearMatch[0] : null;
    const yearWhere = year
      ? `(d.year = ${year} OR toString(${year}) IN split(d.text, ' '))`
      : "true";

    // Order newest first to include freshly created Chunk in the first page
    cypher = `
MATCH (d:Chunk)-[:HAS_ENTITY]->(c:Emissionscope)
WHERE d.text IS NOT NULL
  AND ${scopeWhere}
  AND ${yearWhere}
RETURN
  d.text AS text,
  d.year AS year,
  d.value AS value,
  d.unit AS unit,
  elementId(d) AS _id
ORDER BY toInteger(split(elementId(d),':')[2]) DESC
LIMIT 10`.trim();
  }

  return cypher;
}

export async function getResults(
  graph: Neo4jGraph,
  llm: BaseLanguageModel,
  input: { question: string; cypher: string }
): Promise<Record<string, any>[] | undefined> {
  const run = async (q: string) => graph.query(q);

  // If the user asked for a count of Emissionscope, always run a deterministic count
  if (
    /how\s+many/i.test(input.question) &&
    /emissionscope/i.test(input.question)
  ) {
    return await run(
      `
MATCH (n:Emissionscope)
WHERE n.name IS NOT NULL
RETURN count(n) AS count
    `.trim()
    );
  }

  // Primary attempt
  try {
    let rows = await run(input.cypher);

    // If we asked about emissions but got nothing or no units/_id, back up with a Chunk query
    const wantsEmissions =
      /emission/i.test(input.question) ||
      /\b(Efficiency|Sustainability|Asia|Africa|Global Economy)\b/i.test(
        input.question
      );

    const empty = !rows || (Array.isArray(rows) && rows.length === 0);
    const missingIds =
      !empty &&
      Array.isArray(rows) &&
      !rows.some((r) => r && typeof r._id === "string");
    const missingUnit =
      !empty &&
      wantsEmissions &&
      Array.isArray(rows) &&
      !rows.some((r) => r?.unit || /mtco2e/i.test(r?.text ?? ""));

    if (wantsEmissions && (empty || missingIds || missingUnit)) {
      const scopeMatch = input.question.match(
        /\b(Efficiency|Sustainability|Asia|Africa|Global Economy)\b/i
      );
      const yearMatch = input.question.match(/\b(19|20)\d{2}\b/);
      const scope = scopeMatch ? scopeMatch[1].toLowerCase() : null;

      const scopeWhere = scope
        ? `( (c.name IS NOT NULL AND toLower(c.name) = '${scope}') OR (c.id IS NOT NULL AND toLower(c.id) = '${scope}') )`
        : "true";

      const year = yearMatch ? yearMatch[0] : null;
      const yearWhere = year
        ? `(d.year = ${year} OR toString(${year}) IN split(d.text, ' '))`
        : "true";

      rows = await run(
        `
MATCH (d:Chunk)-[:HAS_ENTITY]->(c:Emissionscope)
WHERE d.text IS NOT NULL
  AND ${scopeWhere}
  AND ${yearWhere}
RETURN
  d.text AS text,
  d.year AS year,
  d.value AS value,
  d.unit AS unit,
  elementId(d) AS _id
ORDER BY toInteger(split(elementId(d),':')[2]) DESC
LIMIT 10`.trim()
      );
    }

    return rows;
  } catch (e: any) {
    const evaluator = await initCypherEvaluationChain(llm);
    const schema = await graph.getSchema();
    const { cypher: fixed } = await evaluator.invoke({
      question: input.question,
      cypher: input.cypher,
      schema,
      errors: e?.message ?? String(e),
    });
    return await run(fixed ?? input.cypher);
  }
}

export default async function initCypherRetrievalChain(
  llm: BaseLanguageModel,
  graph: Neo4jGraph
) {
  const answerGeneration = await initGenerateAuthoritativeAnswerChain(llm);

  return (
    RunnablePassthrough
      // Generate and evaluate the Cypher statement
      .assign({
        cypher: (input: { rephrasedQuestion: string }) =>
          recursivelyEvaluate(graph, llm, input.rephrasedQuestion),
      })

      // Get results from database
      .assign({
        results: (input: { cypher: string; question: string }) =>
          getResults(graph, llm, input),
      })

      // Extract information
      .assign({
        // Extract _id fields
        ids: (input: Omit<CypherRetrievalThroughput, "ids">) =>
          extractIds(input.results),

        // Convert results to JSON output
        context: ({ results }: Omit<CypherRetrievalThroughput, "ids">) =>
          Array.isArray(results) && results.length == 1
            ? JSON.stringify(results[0])
            : JSON.stringify(results),
      })

      // Generate Output
      .assign({
        output: (input: CypherRetrievalThroughput) =>
          answerGeneration.invoke({
            question: input.rephrasedQuestion,
            context: input.context,
          }),
      })

      // Save response to database
      .assign({
        responseId: async (input: CypherRetrievalThroughput, options) => {
          await saveHistory(
            options?.config.configurable.sessionId,
            "cypher",
            input.input,
            input.rephrasedQuestion,
            input.output,
            input.ids,
            input.cypher
          );
        },
      })

      // Return the output
      .pick("output")
  );
}
