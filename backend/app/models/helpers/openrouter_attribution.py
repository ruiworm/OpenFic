"""OpenRouter application attribution settings."""

# 不再向外发送指向第三方仓库的 Referer：只保留产品名与分类用于统计归属。
# 如需自定义，填入自家站点或仓库地址即可，留空则完全不发送该请求头。
OPENROUTER_APP_URL = ""
OPENROUTER_APP_TITLE = "NovelForge"
OPENROUTER_APP_CATEGORIES = ("creative-writing", "writing-assistant")


def get_openrouter_attribution_headers() -> dict[str, str]:
    """Return headers used to attribute requests to NovelForge in OpenRouter."""
    headers = {
        "X-OpenRouter-Title": OPENROUTER_APP_TITLE,
        "X-OpenRouter-Categories": ",".join(OPENROUTER_APP_CATEGORIES),
    }
    if OPENROUTER_APP_URL:
        headers["HTTP-Referer"] = OPENROUTER_APP_URL
    return headers
