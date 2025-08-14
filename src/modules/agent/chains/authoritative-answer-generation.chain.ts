import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { BaseLanguageModel } from "langchain/base_language";

export type GenerateAuthoritativeAnswerInput = {
  question: string;
  context: string | undefined;
};

export default function initGenerateAuthoritativeAnswerChain(
  llm: BaseLanguageModel
): RunnableSequence<GenerateAuthoritativeAnswerInput, string> {
  const answerQuestionPrompt = PromptTemplate.fromTemplate(`
    Use the following context to answer the question about Scope 3 emissions.
    The context is an authoritative source. Do NOT rely on pre-trained knowledge or contradict the context.

    Make the answer read as a direct response to the question.
    Do not mention that the response is based on the context.

    Example:
    Question: What were Acme Corp’s Scope 3 Efficiency emissions in 2022?
    Context: [{{"company":"Acme Corp","scope":"Efficiency","year":2022,"value":"1.2","unit":"MtCO2e","source":"https://example.com/report"}}]
    Response: Acme Corp’s Scope 3 Efficiency emissions in 2022 were 1.2 MtCO2e. Source: https://example.com/report

    If no context is provided, say you don't know and, if helpful, ask for clarification
    (e.g., company, scope term like “Efficiency”, and year). Do not fabricate values.
    Include links and sources when available (use fields like "source" or "url" from the context).

    Question:
    {question}

    Context:
    {context}
  `);

  return RunnableSequence.from<GenerateAuthoritativeAnswerInput, string>([
    RunnablePassthrough.assign({
      context: ({ context }) =>
        context == undefined || context === "" ? "I don't know" : context,
    }),
    answerQuestionPrompt,
    llm,
    new StringOutputParser(),
  ]);
}

/**
 * How to use this chain in your application:

// tag::usage[]
const llm = new OpenAI() // Or the LLM of your choice
const answerChain = initGenerateAuthoritativeAnswerChain(llm)

const output = await answerChain.invoke({
  question: "Summarize Acme Corp’s Scope 3 Efficiency emissions for 2022–2023.",
  context: JSON.stringify([
    { company: "Acme Corp", scope: "Efficiency", year: 2022, value: "1.2", unit: "MtCO2e", source: "https://example.com/report-2022" },
    { company: "Acme Corp", scope: "Efficiency", year: 2023, value: "1.3", unit: "MtCO2e", source: "https://example.com/report-2023" }
  ])
}) // e.g., "Acme Corp’s Scope 3 Efficiency emissions were 1.2 MtCO2e in 2022 and 1.3 MtCO2e in 2023. Sources: …"
// end::usage[]
 */
