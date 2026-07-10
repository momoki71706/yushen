#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小晴与屿深的 App —— 亲密设备桥接程序 (SVAKOM SX014A)

作用：
  你的后端跑在云端，够不到你家里蓝牙连着的设备。这个小程序就是那个“中间人”——
  它在你的电脑上运行，一边用蓝牙连着设备，一边每隔一小段时间去云端问一次
  “现在该震多强”，然后把指令写给设备（并且持续重发，这样才不会震一下就停）。

  指令是之前抓包破解出来的真实协议：
     写到特征值 FFE1： 55 04 00 00 00 <强度0-254> AA
     停止：            55 04 00 00 00 00 AA

怎么用（只需设置一次）：
  1. 装 Python（python.org，勾选 Add to PATH）
  2. 打开命令行，装两个库：
         pip install bleak requests
  3. 把下面这两行改成你自己的（在 App 的“亲密控制”面板里能看到）：
         BACKEND_URL 和 TOKEN
  4. 运行：
         python svakom_bridge.py
  5. 保持这个窗口开着。要用的时候电脑开着、设备开机、离电脑近一点就行。
     不用的时候直接关掉这个窗口，设备就再也不会被控制（最安全）。
"""

import asyncio
import sys

try:
    import requests
except ImportError:
    print("缺少 requests 库，请先运行：pip install requests")
    sys.exit(1)

try:
    from bleak import BleakScanner, BleakClient
except ImportError:
    print("缺少 bleak 库，请先运行：pip install bleak")
    sys.exit(1)

# ======================= 需要你填的两处 =======================
# App 的“亲密控制”面板里会显示这两个值，复制过来即可。
BACKEND_URL = "https://你的后端地址.zeabur.app"   # 例如 https://xxxx.zeabur.app
TOKEN = "把面板里的那串 token 粘到这里"
# =============================================================

# 以下一般不用改
DEVICE_NAME = "SX014A-2"          # 设备蓝牙名（nRF Connect 里看到的那个）
WRITE_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"  # FFE1 写入特征
POLL_INTERVAL = 0.35              # 每隔多少秒问一次云端 + 重发一次保活
SCAN_TIMEOUT = 15.0              # 扫描设备最多等多少秒


def build_command(intensity_percent: int) -> bytes:
    """把 0-100 的强度百分比映射到设备的 0-254，拼成真实指令字节。"""
    pct = max(0, min(100, int(intensity_percent)))
    speed = round(pct * 254 / 100)          # 0-254
    return bytes([0x55, 0x04, 0x00, 0x00, 0x00, speed, 0xAA])


STOP_COMMAND = build_command(0)


def poll_backend() -> int:
    """向云端问当前想要的强度（0-100）。任何出错都当作 0（失败即停，最安全）。"""
    try:
        r = requests.get(
            f"{BACKEND_URL.rstrip('/')}/api/device/poll",
            params={"token": TOKEN},
            timeout=2.5,
        )
        if r.status_code != 200:
            return 0
        return int(r.json().get("intensity", 0))
    except Exception:
        return 0


async def find_device():
    print(f"正在扫描设备 {DEVICE_NAME} …（请确保设备已开机、就在电脑附近，并已在手机 App 里断开）")
    device = await BleakScanner.find_device_by_filter(
        lambda d, ad: (d.name or "") == DEVICE_NAME,
        timeout=SCAN_TIMEOUT,
    )
    return device


async def run_session(device):
    async with BleakClient(device) as client:
        print(f"已连接：{DEVICE_NAME}。开始工作——关掉这个窗口即可随时停止。")
        last_sent = None
        while True:
            intensity = poll_backend()
            cmd = build_command(intensity)
            # 强度变化时必发；强度不变但非零时也持续重发（保活，否则设备只震一下）。
            if cmd != last_sent or intensity > 0:
                try:
                    await client.write_gatt_char(WRITE_UUID, cmd, response=False)
                    last_sent = cmd
                except Exception as e:
                    print(f"写入失败（可能断连）：{e}")
                    raise
            await asyncio.sleep(POLL_INTERVAL)


async def main():
    if "你的后端地址" in BACKEND_URL or "粘到这里" in TOKEN:
        print("请先在文件顶部把 BACKEND_URL 和 TOKEN 改成你自己的值（App 的“亲密控制”面板里有）。")
        return
    while True:
        try:
            device = await find_device()
            if not device:
                print("没扫描到设备，5 秒后重试。检查：设备开机了吗？手机 App 里断开连接了吗？")
                await asyncio.sleep(5)
                continue
            await run_session(device)
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"连接中断：{e}。3 秒后重新连接…")
            await asyncio.sleep(3)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n已退出，设备不会再被控制。")
