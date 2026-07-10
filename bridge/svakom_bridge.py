#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Xiaoqing App - intimate device bridge (SVAKOM SX014A)

This runs on your PC, connects to the toy over Bluetooth, and a few times a
second asks the cloud backend "what intensity now?", then writes it to the
device (repeating to keep it alive).

Command it was reverse-engineered to speak (characteristic FFE1):
    vibrate: 55 04 00 00 00 <speed 0-254> AA
    stop:    55 04 00 00 00 00 AA

USAGE (no file editing needed - pass the two values on the command line):
    py svakom_bridge.py <BACKEND_URL> <TOKEN>

Example:
    py svakom_bridge.py https://shenqinghome.zeabur.app e4c88ba3....c840

Both values are shown in the app's "亲密控制" panel. Keep this window open
while using it; close it to stop everything (the safest kill switch).
Setup once:  pip install bleak requests   (or: py -m pip install bleak requests)
"""

import asyncio
import sys

try:
    import requests
except ImportError:
    print("Missing 'requests'. Run: py -m pip install requests")
    sys.exit(1)

try:
    from bleak import BleakScanner, BleakClient
except ImportError:
    print("Missing 'bleak'. Run: py -m pip install bleak")
    sys.exit(1)

# Values can come from the command line (preferred) or be filled in here.
BACKEND_URL = ""   # e.g. https://shenqinghome.zeabur.app
TOKEN = ""         # from the app panel

if len(sys.argv) >= 3:
    BACKEND_URL = sys.argv[1]
    TOKEN = sys.argv[2]

# Rarely-changed settings.
DEVICE_NAME = "SX014A-2"
WRITE_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"
POLL_INTERVAL = 0.35
SCAN_TIMEOUT = 15.0


def build_command(intensity_percent):
    pct = max(0, min(100, int(intensity_percent)))
    speed = round(pct * 254 / 100)
    return bytes([0x55, 0x04, 0x00, 0x00, 0x00, speed, 0xAA])


# Tracks backend reachability so we only print when it changes, not every tick.
_last_backend_ok = None


def poll_backend():
    """Ask the cloud for the desired intensity (0-100). Any failure -> 0 (fail safe)."""
    global _last_backend_ok
    url = BACKEND_URL.rstrip("/") + "/api/device/poll"
    try:
        r = requests.get(url, params={"token": TOKEN}, timeout=2.5)
        if r.status_code == 403:
            if _last_backend_ok is not False:
                print("[云端] 403 - TOKEN 不对，请核对 app 面板里的 token。")
                _last_backend_ok = False
            return 0
        if r.status_code != 200:
            if _last_backend_ok is not False:
                print("[云端] HTTP", r.status_code, "- 地址可能不对：", url)
                _last_backend_ok = False
            return 0
        if _last_backend_ok is not True:
            print("[云端] 连接正常，开始接收指令。")
            _last_backend_ok = True
        return int(r.json().get("intensity", 0))
    except Exception as e:
        if _last_backend_ok is not False:
            print("[云端] 连不上：", e)
            print("       检查 BACKEND_URL 是否正确、电脑是否能上网。")
            _last_backend_ok = False
        return 0


async def find_device():
    print("正在扫描设备 %s ... (设备开机、就在电脑附近、并已在手机 App 里断开)" % DEVICE_NAME)
    return await BleakScanner.find_device_by_filter(
        lambda d, ad: (d.name or "") == DEVICE_NAME,
        timeout=SCAN_TIMEOUT,
    )


async def run_session(device):
    async with BleakClient(device) as client:
        print("已连接设备：%s。开始工作 - 关掉这个窗口即可随时停止。" % DEVICE_NAME)
        last_sent = None
        last_shown = -1
        while True:
            intensity = poll_backend()
            if intensity != last_shown:
                print("当前强度：%d" % intensity)
                last_shown = intensity
            cmd = build_command(intensity)
            if cmd != last_sent or intensity > 0:
                try:
                    await client.write_gatt_char(WRITE_UUID, cmd, response=False)
                    last_sent = cmd
                except Exception as e:
                    print("写入失败（可能断连）：", e)
                    raise
            await asyncio.sleep(POLL_INTERVAL)


async def main():
    if not BACKEND_URL or not TOKEN:
        print("用法： py svakom_bridge.py <BACKEND_URL> <TOKEN>")
        print("例如： py svakom_bridge.py https://shenqinghome.zeabur.app 你的token")
        return
    print("后端：", BACKEND_URL)
    while True:
        try:
            device = await find_device()
            if not device:
                print("没扫描到设备，5 秒后重试。设备开机了吗？手机 App 里断开连接了吗？")
                await asyncio.sleep(5)
                continue
            await run_session(device)
        except KeyboardInterrupt:
            break
        except Exception as e:
            print("连接中断：", e, "。3 秒后重连…")
            await asyncio.sleep(3)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n已退出，设备不会再被控制。")
