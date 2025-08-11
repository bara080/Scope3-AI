import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { BaseLanguageModel } from "@langchain/core/language_models/base";

export type GenerateAuthoritativeAnswerInput = {
  question: string;
  context?: string;
};

export default function initGenerateAuthoritativeAnswerChain(
  llm: BaseLanguageModel
): RunnableSequence<GenerateAuthoritativeAnswerInput, string> {
  const prompt = PromptTemplate.fromTemplate(
    `Answer authoritatively using ONLY the context. If unknown, say "I don't know".

Context:
{context}

Question:
{question}`
  );

  return RunnableSequence.from<GenerateAuthoritativeAnswerInput, string>([
    prompt,
    llm,
    new StringOutputParser(),
  ]);
}
