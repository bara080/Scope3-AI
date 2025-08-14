import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";

import { BaseChatModel } from "langchain/chat_models/base";
import { ChatbotResponse } from "../history";

// tag::interface[]
export type RephraseQuestionInput = {
  // The user's question
  input: string;
  // Conversation history of {input, output} from the database
  history: ChatbotResponse[];
};
// end::interface[]

// tag::function[]
export default function initRephraseChain(llm: BaseChatModel) {
  // TODO: Create Prompt template
  // Prompt template

  // const rephraseQuestionChainPrompt = PromptTemplate.fromTemplate<RephraseQuestionInput, string>(...)

  // Prompt template
  const rephraseQuestionChainPrompt = PromptTemplate.fromTemplate<
    RephraseQuestionInput,
    string
  >(`
  Given the following conversation and a question,
  rephrase the follow-up question to be a standalone question about the
  subject of the conversation history.

  If you do not have the required information required to construct
  a standalone question, ask for clarification.

  Always include the subject of the history in the question.

  History:
  {history}

  Question:
  {input}
`);
  // TODO: Create Runnable Sequence
  // return RunnableSequence.from<RephraseQuestionInput, string>(
  return RunnableSequence.from<RephraseQuestionInput, string>([
    // <1> Convert message history to a string
    RunnablePassthrough.assign({
      history: ({ history }): string => {
        if (history.length == 0) {
          return "No history";
        }
        return history
          .map(
            (response: ChatbotResponse) =>
              `Human: ${response.input}\nAI: ${response.output}`
          )
          .join("\n");
      },
    }),
    // <2> Use the input and formatted history to format the prompt
    rephraseQuestionChainPrompt,
    // <3> Pass the formatted prompt to the LLM
    llm,
    // <4> Coerce the output into a string
    new StringOutputParser(),
  ]);
}
// end::function[]
/**
 * How to use this chain in your application:

// tag::usage[]
const llm = new OpenAI() // Or the LLM of your choice
const rephraseAnswerChain = initRephraseChain(llm)

const output = await rephraseAnswerChain.invoke({
  input: 'What about 2023?',
  history: [{
    input: 'Show Acme Corp’s Efficiency (Scope 3) emissions for 2022.',
    output: 'Acme Corp — Efficiency (2022): 1.2 MtCO2e.',
  }]
}) // What are Acme Corp’s Efficiency (Scope 3) emissions for 2023?
// end::usage[]
 */
