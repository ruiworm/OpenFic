"""工具参数载荷的确定性归一化。

某些模型（实测 `DeepSeek-V4-Flash-Vision-Exp`）会把 OpenAI 工具调用协议里的
`arguments` 字段名，当成参数本体再包一层，例如把

    {"query": "契琴伊察 通道"}

吐成

    {"arguments": {"query": "契琴伊察 通道"}}

也有吐两层的情况（模型读到自己的历史输出后继续加壳）。这层外壳在协议上是
没有意义的：工具本身并不知道 `arguments` 这个键，于是参数校验会以
`query: Field required` 之类的形式失败，白烧一轮；更糟的是带壳的参数会被
写入会话历史，反过来教模型继续这么写。

因此这里在**解析阶段**把外壳剥掉，外壳不具备任何语义，剥离是信息无损的。
本模块只做归一化，不抛异常。
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

#: 外壳上允许出现的键名。
#: 之所以敢剥离，是因为全仓没有任何工具的入参叫 `arguments`（已核对
#: agent_runtime/tools 下全部 args_schema），而 `name` / `type` 是工具调用
#: 信封自带的字段，模型偶尔会连着一起吐出来。
_ENVELOPE_KEYS = frozenset({"arguments", "name", "type"})

#: 最多剥离层数，兜住模型自我模仿导致的层层加壳。
_MAX_UNWRAP_DEPTH = 3


def unwrap_tool_arg_envelope(args: Mapping[str, Any] | None) -> dict[str, Any]:
    """剥离模型多套的工具参数外壳，返回干净参数。

    仅在**明确是外壳**时才剥离，其余情况原样返回：

    - 必须存在 `arguments` 键；
    - 除 `arguments` / `name` / `type` 外不能有别的键（避免丢参数）；
    - `arguments` 的值必须是对象（映射），不是字符串/数字等。

    例::

        >>> unwrap_tool_arg_envelope({"arguments": {"query": "x"}})
        {'query': 'x'}
        >>> unwrap_tool_arg_envelope({"query": "x"})
        {'query': 'x'}
    """
    current: dict[str, Any] = dict(args) if isinstance(args, Mapping) else {}
    for _ in range(_MAX_UNWRAP_DEPTH):
        if "arguments" not in current:
            break
        if not set(current) <= _ENVELOPE_KEYS:
            break
        inner = current["arguments"]
        if not isinstance(inner, Mapping):
            break
        current = dict(inner)
    return current
