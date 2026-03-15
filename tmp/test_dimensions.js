const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function checkDimensions() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  
  try {
    const result = await model.embedContent("test");
    console.log("Dimensions:", result.embedding.values.length);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkDimensions();
