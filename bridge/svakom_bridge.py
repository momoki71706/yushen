#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Xiaoqing App - intimate device bridge (SVAKOM SX014A)

This runs on your PC, connects to the toy over Bluetooth, and continuously
asks the cloud backend "what intensity now?", then writes it to the device
(repeating to keep it alive).

Command reverse-engineered from a capture (characteristic FFE1):
    vibrate: 55 04 00 00 00 <speed 0-254> AA
    stop:    55 04 00 00 00 00 AA

USAGE (no file editing - pass the two values on the command line):
    py svakom_bridge.py <BACKEND_URL> <TOKEN>

Example:
    py svakom_bridge.py https://shenqinghome.zeabur.app e4c88ba3....c840

Both values are in the app's "亲密控制" panel. Keep this window open while
using it; close it to stop everything (the safest kill switch).
Setup once:  py -m pip install bleak requests

Network note: the poll runs in a background thread so a slow/timed-out
request never interrupts the Bluetooth keepalive, and a brief hiccup holds
the last intensity (GRACE_SECONDS) instead of stuttering to a stop. Only a
sustained outage falls back to off.
"""

import asyncio
import sys
import time

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

BACKEND_URL = ""
TOKEN = ""
if len(sys.argv) >= 3:
    BACKEND_URL = sys.argv[1]
    TOKEN = sys.argv[2]

DEVICE_NAME = "SX014A-2"
WRITE_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"
WRITE_INTERVAL = 0.35   # how often we (re)write the current intensity to the device
POLL_INTERVAL = 0.4     # how often the background thread asks the cloud
HTTP_TIMEOUT = 5.0      # generous, for high-latency links
GRACE_SECONDS = 6.0     # hold last intensity through brief network hiccups
SCAN_TIMEOUT = 15.0

# Shared between the poll thread and the write loop.
_state = {"intensity": 0, "last_ok": 0.0}
_backend_status = {"shown": None}  # only print on change


def build_command(intensity_percent):
    pct = max(0, min(100, int(intensity_percent)))
    speed = round(pct * 254 / 100)
    return bytes([0x55, 0x04, 0x00, 0x00, 0x00, speed, 0xAA])


def poll_backend_once():
    """Returns (ok, intensity). Runs in a worker thread so it never blocks BLE."""
    url = BACKEND_URL.rstrip("/") + "/api/device/poll"
    try:
        r = requests.get(url, params={"token": TOKEN}, timeout=HTTP_TIMEOUT)
        if r.status_code == 403:
            _note("bad_token", "[云端] 403 - TOKEN 不对，请核对 app 面板里的 token。")
            return False, 0
        if r.status_code != 200:
            _note("bad_url", "[云端] HTTP %s - 地址可能不对：%s" % (r.status_code, url))
            return False, 0
        _note("ok", "[云端] 连接正常。")
        return True, int(r.json().get("intensity", 0))
    except Exception:
        # A single slow/timed-out request is normal on a high-latency link;
        # don't spam. The grace window smooths it over silently.
        _note("slow", None)
        return False, 0


def _note(kind, msg):
    if _backend_status["shown"] != kind:
        _backend_status["shown"] = kind
        if msg:
            print(msg)


async def poller():
    loop = asyncio.get_event_loop()
    while True:
        ok, val = await loop.run_in_executor(None, poll_backend_once)
        if ok:
            _state["intensity"] = val
            _state["last_ok"] = time.monotonic()
        await asyncio.sleep(POLL_INTERVAL)


async def find_device():
    print("正在扫描设备 %s ... (设备开机、就在电脑附近、并已在手机 App 里断开)" % DEVICE_NAME)
    return await BleakScanner.find_device_by_filter(
        lambda d, ad: (d.name or "") == DEVICE_NAME,
        timeout=SCAN_TIMEOUT,
    )


async def run_session(device):
    async with BleakClient(device) as client:
        print("已连接设备：%s。开始工作 - 关掉这个窗口即可随时停止。" % DEVICE_NAME)
        task = asyncio.ensure_future(poller())
        last_sent = None
        last_shown = -1
        try:
            while True:
                # Hold the last known intensity through brief hiccups; only a
                # sustained outage (> GRACE_SECONDS) falls back to off.
                if time.monotonic() - _state["last_ok"] < GRACE_SECONDS:
                    intensity = _state["intensity"]
                else:
                    intensity = 0
                if intensity != last_shown:
                    print("当前强度：%d" % intensity)
                    last_shown = intensity
                cmd = build_command(intensity)
                if cmd != last_sent or intensity > 0:
                    await client.write_gatt_char(WRITE_UUID, cmd, response=False)
                    last_sent = cmd
                await asyncio.sleep(WRITE_INTERVAL)
        finally:
            task.cancel()


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
