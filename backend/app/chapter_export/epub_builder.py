# -*- coding: utf-8 -*-
"""
EPUB 3.0 生成器 - 将小说章节与卷结构打包为符合规范的 EPUB 电子书。
零外部第三方依赖，使用标准库 zipfile 和 xml 格式化。
"""

from __future__ import annotations

import html
from io import BytesIO
from pathlib import Path
import time
import uuid
import zipfile


def _xml_escape(text: str) -> str:
    return html.escape(text, quote=True)


CSS_STYLE = """\
@charset "utf-8";
body {
    font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "PingFang SC", serif;
    line-height: 1.8;
    margin: 1.2em 1.5em;
    color: #222222;
}
h1.book-title {
    text-align: center;
    font-size: 2em;
    margin-top: 30vh;
    margin-bottom: 0.5em;
    font-weight: bold;
}
p.book-meta {
    text-align: center;
    color: #666666;
    font-size: 0.9em;
    margin-bottom: 0.4em;
}
h2.volume-title {
    text-align: center;
    font-size: 1.6em;
    margin-top: 25vh;
    margin-bottom: 1em;
    font-weight: bold;
    page-break-before: always;
}
h2.chapter-title {
    text-align: center;
    font-size: 1.35em;
    margin-top: 1em;
    margin-bottom: 1.5em;
    font-weight: 600;
    page-break-before: always;
}
p {
    text-indent: 2em;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    text-align: justify;
}
nav#toc ol {
    list-style-type: none;
    padding-left: 1.5em;
}
nav#toc li {
    margin: 0.4em 0;
}
nav#toc a {
    text-decoration: none;
    color: inherit;
}
"""


def build_epub_file(
    output_path: Path,
    *,
    book_title: str,
    author: str = "佚名",
    description: str = "",
    cover_bytes: bytes | None = None,
    volumes: list[dict[str, object]],
    chapters: list[dict[str, object]],
) -> None:
    """
    构建标准 EPUB 电子书文件。

    :param output_path: 输出 .epub 文件路径
    :param book_title: 书名
    :param author: 作者名
    :param description: 作品简介
    :param cover_bytes: 封面图片二进制（可选，jpeg/png）
    :param volumes: 卷列表 [{"id": ..., "title": ..., "order": ...}]
    :param chapters: 章节列表 [{"id": ..., "volume_id": ..., "title": ..., "content": ...}]
    """
    book_uuid = str(uuid.uuid4())
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # 建立卷与章节的从属关系
    volume_by_id = {str(v.get("id")): v for v in volumes}
    organized_items: list[tuple[str, str, str | None]] = []  # (type, id, title)
    
    # 建立章节映射
    has_volumes = bool(volumes)

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. 规范要求 mimetype 必须是未压缩且位于压缩包首个字节
        zf.writestr(
            "mimetype",
            b"application/epub+zip",
            compress_type=zipfile.ZIP_STORED,
        )

        # 2. META-INF/container.xml
        container_xml = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>"""
        zf.writestr("META-INF/container.xml", container_xml.encode("utf-8"))

        # 3. 样式表
        zf.writestr("OEBPS/style.css", CSS_STYLE.encode("utf-8"))

        manifest_items: list[str] = [
            '<item id="style" href="style.css" media-type="text/css"/>',
            '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
            '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        ]
        spine_items: list[str] = [
            '<itemref idref="titlepage"/>',
            '<itemref idref="nav"/>',
        ]
        nav_ol_items: list[str] = []
        ncx_nav_points: list[str] = []
        play_order = 1

        # 4. 扉页 (titlepage.xhtml)
        manifest_items.append('<item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>')
        desc_escaped = _xml_escape(description).replace("\n", "</p><p>") if description else ""
        titlepage_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
    <meta charset="utf-8"/>
    <title>{_xml_escape(book_title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <h1 class="book-title">{_xml_escape(book_title)}</h1>
    <p class="book-meta">作者：{_xml_escape(author)}</p>
    <p class="book-meta">生成时间：{now_iso[:10]}</p>
    {f'<div style="margin-top: 3em;"><p>{desc_escaped}</p></div>' if desc_escaped else ''}
</body>
</html>"""
        zf.writestr("OEBPS/titlepage.xhtml", titlepage_xhtml.encode("utf-8"))

        # 5. 写入章节正文文件
        last_vol_id: str | None = None
        vol_count = 0
        chap_count = 0

        for ch in chapters:
            chap_id = str(ch.get("id"))
            vol_id = str(ch.get("volume_id")) if ch.get("volume_id") else None
            chap_title = str(ch.get("title") or "未命名章节")
            chap_content = str(ch.get("content") or "")

            # 遇到新卷插入卷扉页
            if has_volumes and vol_id and vol_id != last_vol_id:
                vol = volume_by_id.get(vol_id)
                if vol:
                    vol_count += 1
                    vol_title = str(vol.get("title") or f"第{vol_count}卷")
                    vol_item_id = f"vol_{vol_id}"
                    vol_href = f"volume_{vol_id}.xhtml"
                    manifest_items.append(f'<item id="{vol_item_id}" href="{vol_href}" media-type="application/xhtml+xml"/>')
                    spine_items.append(f'<itemref idref="{vol_item_id}"/>')

                    vol_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
    <meta charset="utf-8"/>
    <title>{_xml_escape(vol_title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <h2 class="volume-title">{_xml_escape(vol_title)}</h2>
</body>
</html>"""
                    zf.writestr(f"OEBPS/{vol_href}", vol_xhtml.encode("utf-8"))

                    nav_ol_items.append(f'<li><a href="{vol_href}">{_xml_escape(vol_title)}</a></li>')
                    ncx_nav_points.append(f"""    <navPoint id="nav_{vol_id}" playOrder="{play_order}">
        <navLabel><text>{_xml_escape(vol_title)}</text></navLabel>
        <content src="{vol_href}"/>
    </navPoint>""")
                    play_order += 1
                last_vol_id = vol_id

            chap_count += 1
            chap_item_id = f"chap_{chap_id}"
            chap_href = f"chap_{chap_id}.xhtml"
            manifest_items.append(f'<item id="{chap_item_id}" href="{chap_href}" media-type="application/xhtml+xml"/>')
            spine_items.append(f'<itemref idref="{chap_item_id}"/>')

            # 格式化正文段落
            paragraphs = chap_content.replace("\r\n", "\n").replace("\r", "\n").split("\n")
            p_tags: list[str] = []
            for p in paragraphs:
                p_clean = p.strip()
                if p_clean:
                    p_tags.append(f"<p>{_xml_escape(p_clean)}</p>")

            chap_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
    <meta charset="utf-8"/>
    <title>{_xml_escape(chap_title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <h2 class="chapter-title">{_xml_escape(chap_title)}</h2>
    {"".join(p_tags)}
</body>
</html>"""
            zf.writestr(f"OEBPS/{chap_href}", chap_xhtml.encode("utf-8"))

            nav_ol_items.append(f'<li><a href="{chap_href}">{_xml_escape(chap_title)}</a></li>')
            ncx_nav_points.append(f"""    <navPoint id="nav_{chap_id}" playOrder="{play_order}">
        <navLabel><text>{_xml_escape(chap_title)}</text></navLabel>
        <content src="{chap_href}"/>
    </navPoint>""")
            play_order += 1

        # 6. nav.xhtml (EPUB 3 导航目录)
        nav_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
<head>
    <meta charset="utf-8"/>
    <title>目录</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <nav epub:type="toc" id="toc">
        <h1>目录</h1>
        <ol>
            {"".join(nav_ol_items)}
        </ol>
    </nav>
</body>
</html>"""
        zf.writestr("OEBPS/nav.xhtml", nav_xhtml.encode("utf-8"))

        # 7. toc.ncx (EPUB 2 兼容导航目录，大部分传统墨水屏阅读器依赖)
        ncx_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:{book_uuid}"/>
        <meta name="dtb:depth" content="2"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle><text>{_xml_escape(book_title)}</text></docTitle>
    <docAuthor><text>{_xml_escape(author)}</text></docAuthor>
    <navMap>
{"".join(ncx_nav_points)}
    </navMap>
</ncx>"""
        zf.writestr("OEBPS/toc.ncx", ncx_xml.encode("utf-8"))

        # 8. content.opf
        manifest_str = "\n        ".join(manifest_items)
        spine_str = "\n        ".join(spine_items)
        opf_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="BookId">urn:uuid:{book_uuid}</dc:identifier>
        <dc:title>{_xml_escape(book_title)}</dc:title>
        <dc:language>zh-CN</dc:language>
        <dc:creator>{_xml_escape(author)}</dc:creator>
        <dc:description>{_xml_escape(description)}</dc:description>
        <meta property="dcterms:modified">{now_iso}</meta>
    </metadata>
    <manifest>
        {manifest_str}
    </manifest>
    <spine toc="ncx">
        {spine_str}
    </spine>
</package>"""
        zf.writestr("OEBPS/content.opf", opf_xml.encode("utf-8"))
