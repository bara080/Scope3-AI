import type { NextApiRequest, NextApiResponse } from "next";
import { driver } from "@/lib/neo4j";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (c:Chunk)
      RETURN c.text AS text
      LIMIT 2
    `);

    const chunks = result.records.map((record) => ({
      text: record.get("text"),
    }));

    res.status(200).json({ chunks });
  } catch (error) {
    console.error("Neo4j query error:", error);
    res.status(500).json({ error: "Query failed" });
  } finally {
    await session.close();
  }
}
