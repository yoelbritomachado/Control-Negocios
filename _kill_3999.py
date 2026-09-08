# -*- coding: utf-8 -*-
"""Mata cualquier node que escuche en el puerto 3999 (huérfano de verificacion)."""
import subprocess

out = subprocess.run(["netstat", "-ano"], capture_output=True, text=True).stdout
pids = set()
for line in out.splitlines():
    if ":3999" in line and "LISTENING" in line:
        pids.add(line.split()[-1])
print("listeners en 3999:", pids or "ninguno")
for pid in pids:
    r = subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True, text=True)
    print("kill", pid, "->", (r.stdout or r.stderr).strip())
out2 = subprocess.run(["netstat", "-ano"], capture_output=True, text=True).stdout
still = [l for l in out2.splitlines() if ":3999" in l]
print("tras limpieza, puerto 3999:", "libre" if not still else still)