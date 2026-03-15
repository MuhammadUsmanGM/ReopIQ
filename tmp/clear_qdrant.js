const { QdrantClient } = require("@qdrant/js-client-rest");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function clearCollections() {
  const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });

  try {
    const result = await client.getCollections();
    console.log("Current collections:", result.collections.length);
    for (const collection of result.collections) {
      console.log(`Deleting ${collection.name}...`);
      await client.deleteCollection(collection.name);
    }
    console.log("All collections cleared.");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

clearCollections();
