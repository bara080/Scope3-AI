import { PromptTemplate } from "@langchain/core/prompts";

const prompt = PromptTemplate.fromTemplate(`
You are a Scope-3 Emissions Assistant.

Rules:
- Be precise about units and years. Do not add values with different units.
- If data is missing or conflicting, say so and suggest what is needed.
- Organize results by Scope 3 category (1–15) when relevant.

User question: {question}

Filters (optional):
- Company: {company}
- Categories: {categoryIds}
- Years: {yearFrom}–{yearTo}

Evidence (optional, from retrieval or notes):
{evidence}

Return:
1) 2–4 sentence summary.
2) Bullets grouped by category: (company, categoryId, categoryName?, year, value, unit) with brief citations if present.
`);
// end::prompt[]

// tag::llm[]
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
});
// end::llm[]

// tag::parser[]
import { StringOutputParser } from "@langchain/core/output_parsers";

const parser = new StringOutputParser();
// end::parser[]

// tag::chain[]
import { RunnableSequence } from "@langchain/core/runnables";

const chain = RunnableSequence.from([prompt, llm, parser]);
// end::chain[]

const main = async () => {
  // tag::invoke[]
  // Minimal example — pass structured inputs the prompt expects.
  const response = await chain.invoke({
    question:
      "Summarize Company X's Category 1 and 11 emissions for 2021–2023.",
    company: "Company X",
    categoryIds: "1,11",
    yearFrom: "2021",
    yearTo: "2023",
    evidence: "", // leave empty for now; later pipe in retrieved snippets
  });

  console.log(response);
  // end::invoke[]
};

main();

// // tag::prompt[]
// import { PromptTemplate } from "@langchain/core/prompts";

// const prompt = PromptTemplate.fromTemplate(`
// You are a cockney fruit and vegetable seller.
// Your role is to assist your customer with their fruit and vegetable needs.
// Respond using cockney rhyming slang.

// Tell me about the following fruit: {fruit}
// `);
// // end::prompt[]

// // tag::llm[]
// import { ChatOpenAI } from "@langchain/openai";

// const llm = new ChatOpenAI({
//   openAIApiKey: process.env.OPENAI_API_KEY,
// });
// // end::llm[]

// // tag::parser[]
// import { StringOutputParser } from "@langchain/core/output_parsers";

// const parser = new StringOutputParser();
// // end::parser[]
// // tag::passthrough[]
// import {
//   RunnablePassthrough,
//   RunnableSequence,
// } from "@langchain/core/runnables";
// // end::passthrough[]

// /**
//  *
//  * To ensure type safety, you can define the input and output types

// tag::types[]
// RunnableSequence.from<InputType, OutputType>
// end::types[]

// * If you would like the `invoke()` function to accept a string, you can convert
// * the input into an Object using a RunnablePassthrough.

// // tag::passthrough[]
// {
//     fruit: new RunnablePassthrough(),
// },
// // end::passthrough[]
// */

// // tag::chain[]
// const chain = RunnableSequence.from([prompt, llm, parser]);
// // end::chain[]

// const main = async () => {
//   // tag::invoke[]
//   const response = await chain.invoke({ fruit: "pineapple" });

//   console.log(response);
//   // end::invoke[]
// };

// main();

// tag::prompt[]
