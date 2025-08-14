import { config } from "dotenv";
import { BaseChatModel } from "langchain/chat_models/base";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import initRephraseChain from "./rephrase-question.chain";
import { ChatbotResponse } from "../history";

describe("Rephrase Question Chain", () => {
  let llm: BaseChatModel;
  let chain: RunnableSequence;
  let evalChain: RunnableSequence<any, any>;

  beforeAll(async () => {
    config({ path: ".env.local" });

    llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-3.5-turbo",
      temperature: 0,
      configuration: {
        baseURL: process.env.OPENAI_API_BASE,
      },
    });

    chain = await initRephraseChain(llm);

    evalChain = RunnableSequence.from([
      PromptTemplate.fromTemplate(`
        Is the rephrased version a complete standalone question that can be answered by an LLM?

        Original: {input}
        Rephrased: {response}

        If the question is a suitable standalone question, respond "yes".
        If not, respond with "no".
        If the rephrased question asks for more information, respond with "missing".
      `),
      llm,
      new StringOutputParser(),
    ]);
  });

  describe("Rephrasing Questions", () => {
    it("should handle a question with no history", async () => {
      const input =
        "What are Acme Corp’s Scope 3 Category 11 emissions for 2022?";

      const response = await chain.invoke({
        input,
        history: [],
      });

      const evaluation = await evalChain.invoke({ input, response });
      expect(`${evaluation.toLowerCase()} - ${response}`).toContain("yes");
    });

    it("should rephrase a question based on its history", async () => {
      const history = [
        {
          input: "Show Acme Corp’s Category 11 emissions for 2022.",
          output: "Acme Corp — Category 11 (2022): 1.2 MtCO2e.",
        },
      ];
      const input = "what about 2023?";
      const response = await chain.invoke({
        input,
        history,
      });

      expect(response).toContain("Acme Corp");
      expect(response).toContain("Category 11");
      expect(response).toContain("2023");

      const evaluation = await evalChain.invoke({ input, response });
      expect(`${evaluation.toLowerCase()} - ${response}`).toContain("yes");
    });

    it("should ask for clarification if a question does not make sense", async () => {
      const input = "What about last week?";
      const history: ChatbotResponse[] = [];

      const response = await chain.invoke({
        input,
        history,
      });

      const evaluation = await evalChain.invoke({ input, response });
      expect(`${evaluation.toLowerCase()} - ${response}`).toContain("provide");
    });
  });
});

// // // rephrase-question.chain.test.ts
// // import { config } from "dotenv";
// // import { BaseChatModel } from "langchain/chat_models/base";
// // import { RunnableSequence } from "@langchain/core/runnables";
// // import { ChatOpenAI } from "@langchain/openai";
// // import { PromptTemplate } from "@langchain/core/prompts";
// // import { StringOutputParser } from "@langchain/core/output_parsers";
// // import initRephraseChain from "./rephrase-question.chain";
// // import { ChatbotResponse } from "../history";

// import { config } from "dotenv";
// import { BaseChatModel } from "langchain/chat_models/base";
// import { RunnableSequence } from "@langchain/core/runnables";
// import { ChatOpenAI } from "@langchain/openai";
// import { PromptTemplate } from "@langchain/core/prompts";
// import { StringOutputParser } from "@langchain/core/output_parsers";
// import initRephraseChain, {
//   RephraseQuestionInput,
// } from "./rephrase-question.chain";
// import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
// import { ChatbotResponse } from "../history";
// import { initGraph, close } from "../../graph";
// describe("Rephrase Question Chain (Scope 3)", () => {
//   let llm: BaseChatModel;
//   let chain: RunnableSequence;
//   let evalChain: RunnableSequence<any, any>;
//   let COMPANY = "Example Co";
//   let SCOPE_LABEL = "Efficiency";

//   beforeAll(async () => {
//     config({ path: ".env.local" });

//     // LLM
//     llm = new ChatOpenAI({
//       openAIApiKey: process.env.OPENAI_API_KEY,
//       modelName: "gpt-3.5-turbo",
//       temperature: 0,
//       configuration: { baseURL: process.env.OPENAI_API_BASE },
//     });

//     chain = await initRephraseChain(llm);

//     // Simple evaluator
//     evalChain = RunnableSequence.from([
//       PromptTemplate.fromTemplate(`
// Is the rephrased version a complete standalone question that can be answered by an LLM?

// Original: {input}
// Rephrased: {response}

// Reply only: "yes" | "no" | "missing".
// `),
//       llm,
//       new StringOutputParser(),
//     ]);

//     // Pull sample values from your graph
//     const graph = await initGraph();

//     // Company name: prefer Stakeholder, else any node with name/id
//     const comp = await graph.query<{ name: string }>(
//       `
//         CALL {
//           MATCH (s:Stakeholder) WHERE coalesce(s.name, s.id) IS NOT NULL
//           RETURN coalesce(s.name, s.id) AS name LIMIT 1
//         }
//         RETURN name
//         `,
//       {},
//       "READ"
//     );
//     if (comp?.[0]?.name) COMPANY = comp[0].name;

//     // Scope term from Emissionscope (your data shows strings like "Efficiency")
//     const cat = await graph.query<{ label: string }>(
//       `
//         MATCH (c:Emissionscope)
//         RETURN coalesce(c.name, c.id) AS label
//         LIMIT 1
//         `,
//       {},
//       "READ"
//     );
//     if (cat?.[0]?.label) SCOPE_LABEL = cat[0].label;
//   });

//   afterAll(async () => {
//     await close();
//   });

//   describe("Rephrasing", () => {
//     it("handles a question with no history", async () => {
//       const input = `What are ${COMPANY}'s Scope 3 (${SCOPE_LABEL}) emissions for 2022?`;
//       const response = await chain.invoke({ input, history: [] });
//       const evaluation = await evalChain.invoke({ input, response });
//       expect(`${evaluation.toLowerCase()} - ${response}`).toContain("yes");
//     });

//     it("rephrases based on history (carry company/scope/year)", async () => {
//       const history: ChatbotResponse[] = [
//         {
//           id: "r1",
//           input: `Show ${COMPANY}'s ${SCOPE_LABEL} emissions for 2022.`,
//           rephrasedQuestion: "",
//           output: `${COMPANY} — ${SCOPE_LABEL} (2022): 1.2 MtCO2e.`,
//           cypher: undefined as any,
//         },
//       ];
//       const input = "What about 2023?";
//       const response = await chain.invoke({ input, history });

//       expect(response).toContain(COMPANY);
//       expect(response).toContain(SCOPE_LABEL);
//       expect(response).toContain("2023");

//       const evaluation = await evalChain.invoke({ input, response });
//       expect(`${evaluation.toLowerCase()} - ${response}`).toContain("yes");
//     });

//     it("asks for clarification when ambiguous", async () => {
//       const input = "What about last week?";
//       const response = await chain.invoke({ input, history: [] });
//       const evaluation = await evalChain.invoke({ input, response });
//       expect(`${evaluation.toLowerCase()} - ${response}`.toLowerCase()).toMatch(
//         /missing|provide/
//       );
//     });
//   });
// });

// import { config } from "dotenv";
// import { BaseChatModel } from "langchain/chat_models/base";
// import { RunnableSequence } from "@langchain/core/runnables";
// import { ChatOpenAI } from "@langchain/openai";
// import { PromptTemplate } from "@langchain/core/prompts";
// import { StringOutputParser } from "@langchain/core/output_parsers";
// import initRephraseChain, {
//   RephraseQuestionInput,
// } from "./rephrase-question.chain";
// import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
// import { ChatbotResponse } from "../history";

// describe("Rephrase Question Chain", () => {
//   let llm: BaseChatModel;
//   let chain: RunnableSequence;
//   let evalChain: RunnableSequence<any, any>;

//   beforeAll(async () => {
//     config({ path: ".env.local" });

//     llm = new ChatOpenAI({
//       openAIApiKey: process.env.OPENAI_API_KEY,
//       modelName: "gpt-3.5-turbo",
//       temperature: 0,
//       configuration: {
//         baseURL: process.env.OPENAI_API_BASE,
//       },
//     });

//     chain = await initRephraseChain(llm);

//     evalChain = RunnableSequence.from([
//       PromptTemplate.fromTemplate(`
//         Is the rephrased version a complete standalone question that can be answered by an LLM?

//         Original: {input}
//         Rephrased: {response}

//         If the question is a suitable standalone question, respond "yes".
//         If not, respond with "no".
//         If the rephrased question asks for more information, respond with "missing".
//       `),
//       llm,
//       new StringOutputParser(),
//     ]);
//   });

//   describe("Rephrasing Questions", () => {
//     it("should handle a question with no history", async () => {
//       const input =
//         "What are Acme Corp’s Scope 3 Category 11 emissions for 2022?";

//       const response = await chain.invoke({
//         input,
//         history: [],
//       });

//       const evaluation = await evalChain.invoke({ input, response });
//       expect(`${evaluation.toLowerCase()} - ${response}`).toContain("yes");
//     });

//     it("should rephrase a question based on its history", async () => {
//       const history = [
//         {
//           input: "Show Acme Corp’s Category 11 emissions for 2022.",
//           output: "Acme Corp — Category 11 (2022): 1.2 MtCO2e.",
//         },
//       ];
//       const input = "what about 2023?";
//       const response = await chain.invoke({
//         input,
//         history,
//       });

//       expect(response).toContain("The Matrix");

//       const evaluation = await evalChain.invoke({ input, response });
//       expect(`${evaluation.toLowerCase()} - ${response}`).toContain("yes");
//     });

//     it("should ask for clarification if a question does not make sense", async () => {
//       const input = "What about last week?";
//       const history: ChatbotResponse[] = [];

//       const response = await chain.invoke({
//         input,
//         history,
//       });

//       const evaluation = await evalChain.invoke({ input, response });
//       expect(`${evaluation.toLowerCase()} - ${response}`).toContain("provide");
//     });
//   });
// });
