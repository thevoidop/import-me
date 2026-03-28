import { pipeline, env } from "@huggingface/transformers";

// Tell it to pull from the Hugging Face CDN
env.allowLocalModels = false;

let extractor = null;

self.addEventListener("message", async (event) => {
  const { id, texts } = event.data;

  try {
    if (!extractor) {
      self.postMessage({ status: "loading" });
      extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      );
      self.postMessage({ status: "ready" });
    }

    const output = await extractor(texts, { pooling: "mean", normalize: true });
    self.postMessage({ id, embeddings: output.tolist() });
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
});
