# -*- coding: utf-8 -*-
"""
FastEmbed client tests - 内置 fastembed 客户端的 provider 路由逻辑。

不依赖真实模型下载：通过伪造 fastembed 模块验证 builtin 分支被正确触发，
以及非 builtin 分支保持原有 HTTP 行为。
"""

import sys
import time
import types
import warnings

import pytest

from app.models.clients.embedding_client import EmbeddingClient, EmbeddingConfig
from app.models.clients.rerank_client import (
    RerankClient,
    RerankConfig,
    RerankItem,
)


def _install_fake_fastembed(monkeypatch) -> dict[str, list[str]]:
    """注入一个伪造的 fastembed 模块，记录调用参数。"""
    embed_calls: dict[str, list[str]] = {"documents": []}

    class FakeTextEmbedding:
        def __init__(self, model_name: str) -> None:
            self.model_name = model_name

        def embed(self, documents: list[str]):
            embed_calls["documents"] = list(documents)
            for _ in documents:
                yield [0.0, 0.1, 0.2]

    class FakeTextCrossEncoder:
        def __init__(self, model_name: str) -> None:
            self.model_name = model_name

        def rerank(self, query: str, documents: list[str]):
            for i in range(len(documents)):
                yield float(len(documents) - i)

    fake_module = types.ModuleType("fastembed")
    fake_module.TextEmbedding = FakeTextEmbedding  # type: ignore[attr-defined]

    rerank_module = types.ModuleType("fastembed.rerank.cross_encoder")
    rerank_module.TextCrossEncoder = FakeTextCrossEncoder  # type: ignore[attr-defined]

    cross_encoder_pkg = types.ModuleType("fastembed.rerank")
    cross_encoder_pkg.cross_encoder = rerank_module  # type: ignore[attr-defined]

    monkeypatch.setitem(sys.modules, "fastembed", fake_module)
    monkeypatch.setitem(sys.modules, "fastembed.rerank", cross_encoder_pkg)
    monkeypatch.setitem(sys.modules, "fastembed.rerank.cross_encoder", rerank_module)
    return embed_calls


@pytest.mark.asyncio
async def test_embedding_client_builtin_uses_fastembed(monkeypatch):
    embed_calls = _install_fake_fastembed(monkeypatch)

    client = EmbeddingClient(
        EmbeddingConfig(
            provider_type="builtin",
            base_url="builtin://local",
            api_key="",
            model_id="BAAI/bge-small-zh-v1.5",
            dimensions=512,
        )
    )

    response = await client.embed(["hello", "world"])
    assert embed_calls["documents"] == ["hello", "world"]
    assert len(response.embeddings) == 2
    assert response.embeddings[0] == [0.0, 0.1, 0.2]

    single = await client.embed_single("query")
    assert single == [0.0, 0.1, 0.2]


@pytest.mark.asyncio
async def test_rerank_client_builtin_uses_fastembed(monkeypatch):
    _install_fake_fastembed(monkeypatch)

    client = RerankClient(
        RerankConfig(
            provider_type="builtin",
            base_url="builtin://local",
            api_key="",
            model_id="Xenova/ms-marco-MiniLM-L-6-v2",
        )
    )

    response = await client.rerank("query", ["doc1", "doc2", "doc3"], top_n=2)
    assert len(response.results) == 2
    assert all(isinstance(item, RerankItem) for item in response.results)
    scores = [item.relevance_score for item in response.results]
    assert scores == sorted(scores, reverse=True)


def test_rerank_client_accepts_builtin_provider():
    client = RerankClient(
        RerankConfig(
            provider_type="builtin",
            base_url="builtin://local",
            api_key="",
            model_id="Xenova/ms-marco-MiniLM-L-6-v2",
        )
    )
    assert client.config.provider_type == "builtin"


def test_embedding_client_uses_openai_compatible_for_ollama_even_when_not_forced():
    client = EmbeddingClient(
        EmbeddingConfig(
            provider_type="ollama",
            base_url="https://ollama.com/v1",
            api_key="test-key",
            model_id="embeddinggemma",
            use_openai_compatible=False,
        )
    )

    from langchain_openai import OpenAIEmbeddings

    with warnings.catch_warnings(record=True) as caught_warnings:
        warnings.simplefilter("always")
        embeddings = client._get_embeddings()

    assert isinstance(embeddings, OpenAIEmbeddings)
    assert not caught_warnings


def test_embedding_client_sends_custom_headers_for_openai_compatible_provider():
    client = EmbeddingClient(
        EmbeddingConfig(
            provider_type="openai-compatible",
            base_url="https://gateway.example/v1",
            api_key="test-key",
            model_id="embedding-model",
            custom_headers={"X-Provider-Token": "custom-token"},
        )
    )

    embeddings = client._get_embeddings()

    assert embeddings.default_headers["X-Provider-Token"] == "custom-token"


def test_rerank_client_forces_openai_compatible_for_non_builtin_provider():
    client = RerankClient(
        RerankConfig(
            provider_type="upstage",
            base_url="https://api.upstage.ai/v1/solar",
            api_key="test-key",
            model_id="solar-rerank",
            use_openai_compatible=True,
        )
    )

    assert client.runtime_provider_type == "openai-compatible"


def test_load_fastembed_model_reuses_cached_instance(monkeypatch):
    """同一模型的第二次加载应复用缓存实例，不再重复构造 onnx 会话。"""
    from app.models.clients import fastembed_embeddings as fe

    fe.invalidate_fastembed_model_cache()
    created: list[str] = []

    class FakeModel:
        def __init__(self, model_name: str) -> None:
            self.model_name = model_name
            created.append(model_name)

    monkeypatch.setattr(fe, "_ensure_model_from_gcs", lambda *a, **k: True)
    monkeypatch.setattr(
        fe,
        "_instantiate_fastembed_model",
        lambda cls, name, cache_dir: FakeModel(name),
    )

    first = fe._load_fastembed_model(FakeModel, "unit-test-model")
    second = fe._load_fastembed_model(FakeModel, "unit-test-model")

    assert first is second
    assert created == ["unit-test-model"]

    fe.invalidate_fastembed_model_cache("unit-test-model")


def test_hf_download_failure_enters_cooldown(monkeypatch, tmp_path):
    """HF 不可达时首次失败会记录冷却，冷却期内不再重复预检。"""
    from app.models.clients import fastembed_embeddings as fe

    fe._download_failures.clear()
    calls = {"count": 0}

    class FakeModel:
        @staticmethod
        def list_supported_models():
            return [
                {
                    "model": "unit/hf-model",
                    "sources": {"hf": "unit/hf-model"},
                    "model_file": "model.onnx",
                }
            ]

    def fake_preflight() -> None:
        calls["count"] += 1
        raise RuntimeError("无法连接到 HuggingFace（网络不可达）")

    monkeypatch.setattr(fe, "_check_hf_reachable", fake_preflight)

    with pytest.raises(RuntimeError):
        fe._ensure_model_from_hf(FakeModel, "unit/hf-model", tmp_path)
    assert calls["count"] == 1

    # 冷却期内：直接快速失败，未再次预检。
    with pytest.raises(RuntimeError):
        fe._ensure_model_from_hf(FakeModel, "unit/hf-model", tmp_path)
    assert calls["count"] == 1

    fe._download_failures.clear()


def test_download_failure_cooldown_expires():
    """冷却窗口过期后应清理失败记录，允许重新尝试。"""
    from app.models.clients import fastembed_embeddings as fe

    key = "hf:unit/expired-model"
    fe._download_failures[key] = (
        time.monotonic() - fe._DOWNLOAD_FAILURE_COOLDOWN_SECONDS - 1,
        "boom",
    )

    assert fe._download_failure_message(key) is None
    assert key not in fe._download_failures
