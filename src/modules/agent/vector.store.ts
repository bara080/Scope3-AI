import { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";

/**
 * Scope 3 vector store using your existing index on text chunks.
 * Assumes nodes like (:Chunk {text, embedding}) linked to emissions.
 */
export default async function initVectorStore(
  embeddings: EmbeddingsInterface
): Promise<Neo4jVectorStore> {
  return Neo4jVectorStore.fromExistingIndex(embeddings, {
    url: process.env.NEO4J_URI as string,
    username: process.env.NEO4J_USERNAME as string,
    password: process.env.NEO4J_PASSWORD as string,
    database: process.env.NEO4J_DATABASE, // optional
    indexName: process.env.EMBEDDING_INDEX ?? "doc-embeddings", // e.g. FOR (n:Chunk) ON (n.embedding)
    textNodeProperty: "text", // adjust if your chunk text prop differs (e.g., "summary")
    embeddingNodeProperty: "embedding", // adjust if needed
    retrievalQuery: `
      // node = indexed chunk; expand to emissions context
      OPTIONAL MATCH (node)-[:DESCRIBES|:MENTIONS]->(e:Emission)
      OPTIONAL MATCH (e)-[:OF]->(c)                       // company/stakeholder node (label-agnostic)
      OPTIONAL MATCH (e)-[:CLASSIFIES]->(cat:Emissionscope) // e.g., 'Efficiency', 'Asia', etc.

      RETURN
        coalesce(node.text, node.summary, "") AS text,
        score,
        {
          _id: elementId(node),
          company: coalesce(c.name, c.id, "N/A"),
          scope: coalesce(cat.name, cat.id, "N/A"),
          year: e.year,
          value: e.value,
          unit: e.unit,
          source: coalesce(node.source, node.url, "")
        } AS metadata
    `,
  });
  // Adjust retrievalQuery as needed to match your data model
  // Ensure the indexName matches your existing vector index
  // Use textNodeProperty and embeddingNodeProperty as per your schema
  // This setup allows you to retrieve text chunks with their embeddings and related emissions context
  // while maintaining the structure of your existing vector store.
  // The retrieval query can be customized to include additional relationships or properties as needed.
  // This function returns a Neo4jVectorStore instance configured for your use case.
  // It can be used for vector similarity search, retrieval-augmented generation, or other
  // applications where you need to leverage the embeddings of text chunks linked to emissions data.
}

// import { EmbeddingsInterface } from "@langchain/core/embeddings";
// import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";

// /**
//  * Create a new vector search index that uses the existing
//  * `moviePlots` index.
//  *
//  * @param {EmbeddingsInterface} embeddings  The embeddings model
//  * @returns {Promise<Neo4jVectorStore>}
//  */
// // tag::function[]
// export default async function initVectorStore(
//   embeddings: EmbeddingsInterface
// ): Promise<Neo4jVectorStore> {
//   const vectorStore = await Neo4jVectorStore.fromExistingIndex(embeddings, {
//     url: process.env.NEO4J_URI as string,
//     username: process.env.NEO4J_USERNAME as string,
//     password: process.env.NEO4J_PASSWORD as string,
//     indexName: "moviePlots",
//     textNodeProperty: "plot",
//     embeddingNodeProperty: "embedding",
//     retrievalQuery: `
//       RETURN
//         node.plot AS text,
//         score,
//         {
//           _id: elementid(node),
//           title: node.title,
//           directors: [ (person)-[:DIRECTED]->(node) | person.name ],
//           actors: [ (person)-[r:ACTED_IN]->(node) | [person.name, r.role] ],
//           tmdbId: node.tmdbId,
//           source: 'https://www.themoviedb.org/movie/'+ node.tmdbId
//         } AS metadata
//     `,
//   });

//   return vectorStore;
// }
// // end::function[]
