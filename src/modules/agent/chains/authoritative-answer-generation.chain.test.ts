import { config } from "dotenv";
import { BaseChatModel } from "langchain/chat_models/base";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import initGenerateAuthoritativeAnswerChain from "./authoritative-answer-generation.chain";

describe("Authoritative Answer Generation Chain (Scope 3)", () => {
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

    chain = await initGenerateAuthoritativeAnswerChain(llm);

    // tag::evalchain[]
    evalChain = RunnableSequence.from([
      PromptTemplate.fromTemplate(`
        Does the following response answer the question provided?

        Question: {question}
        Response: {response}

        Respond simply with "yes" or "no".

        If the response answers the question, reply with "yes".
        If the response does not answer the question, reply with "no".
        If the response asks for more information, reply with "no".
      `),
      llm,
      new StringOutputParser(),
    ]);
    // end::evalchain[]
  });

  describe("Simple RAG", () => {
    it("should use context to answer the question", async () => {
      const question =
        "What were Acme Corp’s Scope 3 Efficiency emissions in 2022?";
      const response = await chain.invoke({
        question,
        context:
          '[{"company":"Acme Corp","scope":"Efficiency","year":2022,"value":"1.2","unit":"MtCO2e","source":"https://example.com/report-2022"}]',
      });

      // tag::eval[]
      const evaluation = await evalChain.invoke({ question, response });
      expect(`${evaluation.toLowerCase()} - ${response}`).toContain("yes");
      // end::eval[]
    });

    it("should refuse to answer if information is not in context", async () => {
      const question =
        "What were Acme Corp’s Scope 3 Efficiency emissions in 2022?";
      const response = await chain.invoke({
        question,
        context: "",
      });

      const evaluation = await evalChain.invoke({ question, response });
      expect(`${evaluation.toLowerCase()} - ${response}`).toContain("no");
    });

    it("should answer this one??", async () => {
      const value = "1.3 MtCO2e";

      const question =
        "What were VegBoom Corp’s Scope 3 Efficiency emissions in 2023?";
      const response = await chain.invoke({
        question,
        context: `{"company":"VegBoom Corp","scope":"Efficiency","year":2023,"value":"${value}","unit":"MtCO2e","source":"https://example.com/report-2023"}`,
      });

      expect(response).toContain("VegBoom");
      expect(response).toContain("2023");
      expect(response).toContain("Efficiency");
      expect(response).toContain("MtCO2e");

      const evaluation = await evalChain.invoke({ question, response });
      // ensure the response string includes the value/unit we provided
      expect(`${evaluation.toLowerCase()} - ${response}`).toContain("MtCO2e");
    });
  });
});
