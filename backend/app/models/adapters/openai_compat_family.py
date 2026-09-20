# -*- coding: utf-8 -*-
"""OpenAI-compatible provider adapters with distinct provider_type values."""

from app.models.adapters.openai_compatible import OpenAICompatibleAdapter


class GroqAdapter(OpenAICompatibleAdapter):
    @property
    def provider_type(self) -> str:
        return "groq"

    def supports_embedding(self) -> bool:
        return False

    def supports_rerank(self) -> bool:
        return False


class HuggingFaceAdapter(OpenAICompatibleAdapter):
    @property
    def provider_type(self) -> str:
        return "huggingface"

    def supports_embedding(self) -> bool:
        return False

    def supports_rerank(self) -> bool:
        return False


class NvidiaAIEndpointsAdapter(OpenAICompatibleAdapter):
    @property
    def provider_type(self) -> str:
        return "nvidia-ai-endpoints"

    def supports_embedding(self) -> bool:
        return True

    def supports_rerank(self) -> bool:
        return True


class CohereAdapter(OpenAICompatibleAdapter):
    @property
    def provider_type(self) -> str:
        return "cohere"

    def supports_embedding(self) -> bool:
        return True

    def supports_rerank(self) -> bool:
        return False


class AmazonNovaAdapter(OpenAICompatibleAdapter):
    @property
    def provider_type(self) -> str:
        return "amazon-nova"

    def supports_embedding(self) -> bool:
        return False

    def supports_rerank(self) -> bool:
        return False


class DashScopeAdapter(OpenAICompatibleAdapter):
    """阿里云百炼 / 通义千问 (Qwen) 适配器。"""

    @property
    def provider_type(self) -> str:
        return "dashscope"

    def supports_embedding(self) -> bool:
        return True

    def supports_rerank(self) -> bool:
        return False


class ZhipuAdapter(OpenAICompatibleAdapter):
    """智谱 AI / GLM-4 适配器。"""

    @property
    def provider_type(self) -> str:
        return "zhipu"

    def supports_embedding(self) -> bool:
        return True

    def supports_rerank(self) -> bool:
        return False


class MoonshotAdapter(OpenAICompatibleAdapter):
    """月之暗面 / Kimi 适配器。"""

    @property
    def provider_type(self) -> str:
        return "moonshot"

    def supports_embedding(self) -> bool:
        return False

    def supports_rerank(self) -> bool:
        return False


class DoubaoAdapter(OpenAICompatibleAdapter):
    """火山引擎 / 豆包 (Doubao) 适配器。"""

    @property
    def provider_type(self) -> str:
        return "doubao"

    def supports_embedding(self) -> bool:
        return True

    def supports_rerank(self) -> bool:
        return False


class MiniMaxAdapter(OpenAICompatibleAdapter):
    """MiniMax 适配器。"""

    @property
    def provider_type(self) -> str:
        return "minimax"

    def supports_embedding(self) -> bool:
        return False

    def supports_rerank(self) -> bool:
        return False


class OllamaAdapter(OpenAICompatibleAdapter):
    """本地 Ollama 适配器。"""

    @property
    def provider_type(self) -> str:
        return "ollama"

    def supports_embedding(self) -> bool:
        return True

    def supports_rerank(self) -> bool:
        return False
