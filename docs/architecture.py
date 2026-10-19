import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

out = sys.argv[1]

INK = "#1f2a24"
MUTED = "#5b6b62"
GREEN = "#2f7d4f"
GREEN_BG = "#e6f2ea"
BLUE = "#2f5f8f"
BLUE_BG = "#e7eef6"
PURPLE = "#6b4fa0"
PURPLE_BG = "#efeaf7"
SAND_BG = "#f6f1e7"
SAND = "#8a6d3b"
GREY_BG = "#f2f4f3"

fig, ax = plt.subplots(figsize=(16, 9.4), dpi=150)
ax.set_xlim(0, 16.2)
ax.set_ylim(-0.6, 9.2)
ax.axis("off")
fig.patch.set_facecolor("white")


def box(x, y, w, h, title, body="", fc=GREY_BG, ec=MUTED, title_color=INK, lw=1.4, ls="-", z=2, title_size=12.5):
    ax.add_patch(
        FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.12", fc=fc, ec=ec, lw=lw, ls=ls, zorder=z)
    )
    if body:
        ax.text(x + w / 2, y + h - 0.28, title, ha="center", va="top", fontsize=title_size, weight="bold", color=title_color, zorder=z + 1)
        ax.text(x + w / 2, y + h - 0.68, body, ha="center", va="top", fontsize=9.6, color=INK, linespacing=1.45, zorder=z + 1)
    else:
        ax.text(x + w / 2, y + h / 2, title, ha="center", va="center", fontsize=title_size, weight="bold", color=title_color, zorder=z + 1)


def group(x, y, w, h, label, fc, ec):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.18", fc=fc, ec=ec, lw=1.2, ls=(0, (4, 3)), zorder=1))
    ax.text(x + 0.18, y + h - 0.16, label, ha="left", va="top", fontsize=11, weight="bold", color=ec, zorder=2)


def arrow(p0, p1, label="", color=INK, label_xy=None, rad=0.0, both=False, fs=9.2, ha="center"):
    ax.annotate(
        "",
        xy=p1,
        xytext=p0,
        arrowprops=dict(arrowstyle="<|-|>" if both else "-|>", color=color, lw=1.5, mutation_scale=14,
                        connectionstyle=f"arc3,rad={rad}", shrinkA=2, shrinkB=2),
        zorder=5,
    )
    if label:
        lx, ly = label_xy if label_xy else ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        ax.text(lx, ly, label, ha=ha, va="center", fontsize=fs, color=color, zorder=6,
                bbox=dict(boxstyle="round,pad=0.18", fc="white", ec="none", alpha=0.95))


# Title
ax.text(0.2, 9.0, "CanopyChain architecture", fontsize=19, weight="bold", color=INK, va="top")
ax.text(0.2, 8.5, "Forest carbon credits verified by satellite and issued on-chain  ·  carbon figures are a prototype estimate, not a certified methodology",
        fontsize=10.5, color=MUTED, va="top")

# Users
box(0.2, 5.9, 2.4, 1.2, "Project owner", "wallet", fc="white", ec=MUTED)
box(0.2, 4.05, 2.4, 1.2, "Approver", "contract admin wallet", fc="white", ec=MUTED)
box(0.2, 2.2, 2.4, 1.2, "Credit buyer", "wallet", fc="white", ec=MUTED)

# Frontend
group(3.2, 1.3, 3.5, 6.5, "Frontend", BLUE_BG, BLUE)
box(3.45, 1.6, 3.0, 5.6, "dApp (Next.js)",
    "wagmi · viem · RainbowKit\nLeaflet map\n\nRegister project\n(draw + sign polygon)\n\nReview: approve / reject\n(signed, fixes inputs)\n\nRun verification\nbefore / after NDVI\n\nRetire → certificate\n\nPublic registry\n(on-chain events)",
    fc="white", ec=BLUE, title_color=BLUE)

# Backend
group(7.3, 0.9, 4.5, 6.9, "Backend (Python · FastAPI)", GREEN_BG, GREEN)
box(7.55, 5.8, 4.0, 1.4, "REST API + integrity gate", "/projects · /review · /verify · /monitor\nsignatures · overlap check · approval gate", fc="white", ec=GREEN, title_color=GREEN, title_size=12)
box(7.55, 3.95, 4.0, 1.65, "Verification engine",
    "cloud mask (SCL) · NDVI · forest ha\nbaseline vs current · deforested ha\ntCO2e = avoided loss × tCO2e/ha",
    fc="white", ec=GREEN, title_color=GREEN)
box(7.55, 2.55, 4.0, 1.05, "Report store", "report JSON + NDVI PNGs · keccak256 hash", fc="white", ec=GREEN, title_color=GREEN)
box(7.55, 1.15, 4.0, 1.05, "Oracle (web3.py)", "separate wallet holding ORACLE_ROLE", fc="white", ec=GREEN, title_color=GREEN)

# Planetary Computer
group(12.8, 4.6, 3.25, 3.2, "Open satellite data", SAND_BG, SAND)
box(13.0, 4.85, 2.85, 2.25, "Planetary Computer", "Microsoft STAC API\nSentinel-2 L2A\n10 m · free · no key", fc="white", ec=SAND, title_color=SAND, title_size=11.5)

# Chain
group(12.8, 0.9, 3.25, 3.4, "Polygon Amoy", PURPLE_BG, PURPLE)
box(13.0, 1.15, 2.85, 2.75, "CanopyCredits",
    "ERC-1155 + AccessControl\ntoken = project × vintage\n90% owner · 10% buffer\nretire → burn + record\nreversal → burn buffer",
    fc="white", ec=PURPLE, title_color=PURPLE, title_size=11.5)

# Arrows: users → dApp
arrow((2.6, 6.5), (3.45, 6.0), "draw + sign", label_xy=(2.95, 6.85), fs=8.8)
arrow((2.6, 4.65), (3.45, 4.65), "sign approval", label_xy=(3.0, 4.95), fs=8.8)
arrow((2.6, 2.8), (3.45, 3.2), "retire", label_xy=(2.95, 2.55), fs=8.8)

# dApp ↔ API
arrow((6.45, 6.5), (7.55, 6.5), "REST", label_xy=(7.0, 6.8), both=True)

# API → engine → store → oracle
arrow((9.55, 5.8), (9.55, 5.6), color=GREEN)
arrow((9.55, 3.95), (9.55, 3.6), color=GREEN)
arrow((9.55, 2.55), (9.55, 2.2), "hash + credits", label_xy=(10.45, 2.37), color=GREEN, fs=8.6)

# engine ↔ PC
arrow((11.55, 5.0), (13.0, 5.6), "STAC search\n+ COG reads", label_xy=(12.27, 4.7), both=True, color=SAND, fs=8.4)

# oracle → contract
arrow((11.55, 1.65), (13.0, 2.0), "registerProject\nsubmitVerification\nflagReversal", label_xy=(12.27, 2.75), color=PURPLE, fs=8.2)

# dApp ↔ contract (routed under the backend)
ax.plot([5.0, 5.0, 14.4, 14.4], [1.6, 0.1, 0.1, 1.15], color=PURPLE, lw=1.5, zorder=4)
ax.annotate("", xy=(14.4, 1.15), xytext=(14.4, 0.6),
            arrowprops=dict(arrowstyle="-|>", color=PURPLE, lw=1.5, mutation_scale=14), zorder=5)
ax.annotate("", xy=(5.0, 1.6), xytext=(5.0, 1.0),
            arrowprops=dict(arrowstyle="-|>", color=PURPLE, lw=1.5, mutation_scale=14), zorder=5)
ax.text(9.55, 0.1, "wallet txs: retire, transfer   ·   reads: getProject, getRetirement, balanceOf, events (registry feed)",
        ha="center", va="center", fontsize=9.2, color=PURPLE, zorder=6, bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="none"))

# shared/contracts.json note
ax.text(14.43, 0.48, "address + ABI: shared/contracts.json", ha="center", va="center", fontsize=8, color=MUTED, style="italic", zorder=6,
        bbox=dict(boxstyle="round,pad=0.15", fc=PURPLE_BG, ec="none"))

fig.savefig(out, bbox_inches="tight", pad_inches=0.25, facecolor="white")
print("wrote", out)
