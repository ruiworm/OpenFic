#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NovelForge 商业授权激活码生成器 (Ed25519 签名体系)
支持 V1 (基础订单签名) 与 V2 (设备硬件指纹绑定 + 有效期控制)。
"""

import argparse
import base64
import json
from pathlib import Path
import sys
import time

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ed25519
except ImportError:
    print("错误: 请先安装 cryptography 库: pip install cryptography", file=sys.stderr)
    sys.exit(1)


PREFIX = "NOVELFORGE"
KEY_DIR = Path(__file__).resolve().parent / "keys"
PRIVATE_KEY_PATH = KEY_DIR / "license_private.pem"
PUBLIC_KEY_PATH = KEY_DIR / "license_public.pem"


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def ensure_keys() -> tuple[ed25519.Ed25519PrivateKey, ed25519.Ed25519PublicKey]:
    KEY_DIR.mkdir(parents=True, exist_ok=True)
    if not PRIVATE_KEY_PATH.exists():
        print(f"[提示] 未找到私钥，正在自动生成新 Ed25519 密钥对到 {KEY_DIR} ...")
        private_key = ed25519.Ed25519PrivateKey.generate()
        public_key = private_key.public_key()

        PRIVATE_KEY_PATH.write_bytes(
            private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
        PUBLIC_KEY_PATH.write_bytes(
            public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        )
        print(f"[完成] 私钥已保存: {PRIVATE_KEY_PATH}")
        print(f"[完成] 公钥已保存: {PUBLIC_KEY_PATH}")
        print("请注意备份私钥，并可将公钥内容配置到 desktop/src/main/license.ts 中。")
        return private_key, public_key

    private_key = serialization.load_pem_private_key(
        PRIVATE_KEY_PATH.read_bytes(),
        password=None,
    )
    if not isinstance(private_key, ed25519.Ed25519PrivateKey):
        raise ValueError("不支持的私钥类型，必须为 Ed25519")
    public_key = private_key.public_key()
    return private_key, public_key


def generate_v1_license(private_key: ed25519.Ed25519PrivateKey, order_id: str) -> str:
    order_bytes = order_id.encode("utf-8")
    sig = private_key.sign(order_bytes)
    return f"{PREFIX}.{b64url_encode(order_bytes)}.{b64url_encode(sig)}"


def generate_v2_license(
    private_key: ed25519.Ed25519PrivateKey,
    order_id: str,
    device_id: str = "*",
    tier: str = "pro",
    days: int | None = None,
) -> str:
    expires_at = None
    if days is not None and days > 0:
        expires_at = int(time.time()) + days * 86400

    payload = {
        "orderId": order_id,
        "deviceId": device_id.strip().upper(),
        "tier": tier,
        "expiresAt": expires_at,
        "createdAt": int(time.time()),
    }
    payload_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    payload_bytes = payload_json.encode("utf-8")
    sig = private_key.sign(payload_bytes)
    return f"{PREFIX}.V2.{b64url_encode(payload_bytes)}.{b64url_encode(sig)}"


def main():
    parser = argparse.ArgumentParser(description="NovelForge 激活码生成器")
    parser.add_argument("--order", default="", help="订单号 / 用户唯一标识 (例如: ORD-2026-8888)")
    parser.add_argument("--device", default="*", help="目标设备硬件码 (例如: NF-D1C0-B107-BEBF，默认为 * 不限制设备)")
    parser.add_argument("--days", type=int, default=None, help="授权有效期天数 (默认永久有效)")
    parser.add_argument("--tier", default="pro", choices=["pro", "standard", "enterprise"], help="授权版本级别")
    parser.add_argument("--v1", action="store_true", help="生成旧版 V1 激活码 (仅签名 orderId)")
    parser.add_argument("--print-pubkey", action="store_true", help="打印当前公钥 PEM 内容")

    args = parser.parse_args()
    private_key, public_key = ensure_keys()

    if args.print_pubkey:
        pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("ascii")
        print("\n----- 当前激活公钥 (用于 license.ts) -----")
        print(pem)
        return

    if not args.order:
        default_order = f"ORD-{int(time.time())}"
        print(f"未指定 --order，自动使用随机订单号: {default_order}")
        order_id = default_order
    else:
        order_id = args.order

    if args.v1:
        code = generate_v1_license(private_key, order_id)
        print("\n==========================================")
        print("生成旧版 V1 激活码成功:")
        print(f"  订单号: {order_id}")
        print("==========================================")
        print(code)
        print("==========================================\n")
    else:
        code = generate_v2_license(
            private_key,
            order_id=order_id,
            device_id=args.device,
            tier=args.tier,
            days=args.days,
        )
        print("\n==========================================")
        print("生成商业版 V2 激活码成功:")
        print(f"  订单编号: {order_id}")
        print(f"  绑定设备: {args.device} ({'通用激活' if args.device == '*' else '一机一码绑定'})")
        print(f"  版本级别: {args.tier}")
        print(f"  有效期限: {str(args.days) + ' 天' if args.days else '永久有效'}")
        print("==========================================")
        print(code)
        print("==========================================\n")


if __name__ == "__main__":
    main()
