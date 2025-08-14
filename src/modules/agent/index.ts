// import initAgent from "./agent";
// import { initGraph } from "../graph";
// import { llm, embeddings } from "../llm";

// export async function call(input: string, sessionId: string): Promise<string> {
//   const graph = await initGraph();
//   const runnable = await initAgent(llm, embeddings, graph); // ensure initAgent RETURNS this

//   if (!runnable || typeof (runnable as any).invoke !== "function") {
//     throw new Error("Agent failed to initialize");
//   }

//   const res = await runnable.invoke({ input }, { configurable: { sessionId } });

//   return typeof res === "string"
//     ? res
//     : (res as any)?.output ?? (res as any)?.content ?? "";
// }

// import { ChatOpenAI } from "@langchain/openai";
// import { OpenAIEmbeddings } from "@langchain/openai";
// import initAgent from "./agent";
// import { initGraph } from "../graph";
// import { sleep } from "@/utils";
// import agent from "./agent";
// import { embeddings, llm } from "../llm";
// import { config } from "dotenv";
// // tag::call[]
// export async function call(input: string, sessionId: string): Promise<string> {
//   // TODO: Replace this code with an agent
//   const graph = await initGraph();
//   // const model = new ChatOpenAI({
//   //   modelName: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
//   //   temperature: 0,
//   // });
//   // //const embeddings = new OpenAIEmbeddings({
//   //   modelName: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-large",
//   // });
//   const agent = await initAgent(llm, embeddings, graph);
//   // Adding agent
//   console.log("Adding agent...");

//   const res = await agent.invoke(input, sessionId);
//   console.log("Agent response:", res);

//   await sleep(2000);
//   return res;
// }
// // end::call[]
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import initAgent from "./agent";
import { initGraph } from "../graph";
import { sleep } from "@/utils";

export async function call(input: string, sessionId: string): Promise<string> {
  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    // Note: only provide a baseURL when using the GraphAcademy Proxy
    configuration: {
      baseURL: process.env.OPENAI_API_BASE,
    },
  });
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.OPENAI_API_BASE,
    },
  });
  // Get Graph Singleton
  const graph = await initGraph();

  const agent = await initAgent(llm, embeddings, graph);
  const res = await agent.invoke({ input }, { configurable: { sessionId } });

  return res;
}
