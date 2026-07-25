export type OllamaRecommendedModel = {
  name: string;
  label: string;
  vendor: string;
  sizeLabel: string;
  bestFor: string;
  installCommand: string;
  ollamaUrl: string;
  sourceUrl: string;
  sourceLabel: string;
};

export const OLLAMA_RECOMMENDED_MODELS: OllamaRecommendedModel[] = [
  {
    name: "phi4-mini:3.8b",
    label: "微软 Phi-4 Mini",
    vendor: "Microsoft",
    sizeLabel: "约 2.5 GB",
    bestFor: "轻量推理、数学、函数调用，适合普通电脑优先尝试",
    installCommand: "ollama pull phi4-mini:3.8b",
    ollamaUrl: "https://ollama.com/library/phi4-mini:3.8b",
    sourceUrl: "https://huggingface.co/microsoft/Phi-4-mini-instruct",
    sourceLabel: "microsoft/Phi-4-mini-instruct",
  },
  {
    name: "phi3:3.8b",
    label: "微软 Phi-3 Mini",
    vendor: "Microsoft",
    sizeLabel: "约 2.2 GB",
    bestFor: "低内存机器、长上下文、英文任务和基础跟单摘要",
    installCommand: "ollama pull phi3:3.8b",
    ollamaUrl: "https://ollama.com/library/phi3:3.8b",
    sourceUrl: "https://huggingface.co/microsoft/Phi-3-mini-128k-instruct",
    sourceLabel: "microsoft/Phi-3-mini-128k-instruct",
  },
  {
    name: "qwen2.5:7b",
    label: "Qwen 2.5 7B",
    vendor: "Alibaba",
    sizeLabel: "约 4.7 GB",
    bestFor: "中文外贸场景、报价文案、多语言沟通",
    installCommand: "ollama pull qwen2.5:7b",
    ollamaUrl: "https://ollama.com/library/qwen2.5:7b",
    sourceUrl: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct",
    sourceLabel: "Qwen/Qwen2.5-7B-Instruct",
  },
  {
    name: "llama3.2:3b",
    label: "Llama 3.2 3B",
    vendor: "Meta",
    sizeLabel: "约 2.0 GB",
    bestFor: "轻量通用聊天、低资源环境、快速测试本地部署",
    installCommand: "ollama pull llama3.2:3b",
    ollamaUrl: "https://ollama.com/library/llama3.2:3b",
    sourceUrl: "https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct",
    sourceLabel: "meta-llama/Llama-3.2-3B-Instruct",
  },
  {
    name: "phi3:14b",
    label: "微软 Phi-3 Medium",
    vendor: "Microsoft",
    sizeLabel: "约 7.9 GB",
    bestFor: "更强推理质量，适合内存更充足的本地机器",
    installCommand: "ollama pull phi3:14b",
    ollamaUrl: "https://ollama.com/library/phi3:14b",
    sourceUrl: "https://huggingface.co/microsoft/Phi-3-medium-128k-instruct",
    sourceLabel: "microsoft/Phi-3-medium-128k-instruct",
  },
];

export function findRecommendedOllamaModel(name: string) {
  return OLLAMA_RECOMMENDED_MODELS.find((model) => model.name === name);
}
