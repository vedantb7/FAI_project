"""Q-Network architecture for Modified Wallz DQN (P1.5).

Implements convolutional neural network with optional Dueling heads.
"""
from __future__ import annotations

try:
    import torch
    import torch.nn as nn
except ImportError:
    torch = None
    nn = None


def resolve_device(device: str = "auto") -> str:
    """'auto' -> 'cuda' when a CUDA GPU is available, else 'cpu'; other values pass through."""
    if device != "auto":
        return device
    return "cuda" if torch is not None and torch.cuda.is_available() else "cpu"


class QNetwork(nn.Module if nn is not None else object):
    """Convolutional Q-Network for Modified Wallz with optional Dueling streams."""

    def __init__(
        self,
        board_size: int,
        num_actions: int,
        channels: int = 64,
        blocks: int = 3,
        hidden: int = 256,
        dueling: bool = False,
        in_planes: int = 14,
        conv_channels: list | None = None,
    ):
        """conv_channels: optional explicit conv widths, e.g. [32, 64, 64] (the proposal's CNN);
        when given it replaces channels/blocks. in_planes: 14 (obs v1) or 16 (obs v2)."""
        if nn is None:
            raise ImportError("PyTorch is required to instantiate QNetwork.")
        super().__init__()

        self.board_size = board_size
        self.num_actions = num_actions
        self.dueling = dueling
        self.channels = channels
        self.blocks = blocks
        self.hidden = hidden
        self.in_planes = in_planes
        self.conv_channels = list(conv_channels) if conv_channels else None

        # 1. Feature extractor: in_planes -> channels -> (blocks convs), or explicit widths
        widths = self.conv_channels or [channels] * (blocks + 1)
        conv_layers = []
        prev = in_planes
        for w in widths:
            conv_layers.extend([
                nn.Conv2d(prev, w, kernel_size=3, padding=1),
                nn.ReLU(inplace=True),
            ])
            prev = w
        self.conv = nn.Sequential(*conv_layers)

        # 2. Dense head
        flat_dim = prev * board_size * board_size
        self.fc = nn.Sequential(
            nn.Linear(flat_dim, hidden),
            nn.ReLU(inplace=True),
        )

        # 3. Output streams
        if dueling:
            self.v_head = nn.Linear(hidden, 1)
            self.a_head = nn.Linear(hidden, num_actions)
        else:
            self.out_head = nn.Linear(hidden, num_actions)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Args:
            x: Tensor of shape (B, 14, N, N) representing canonical observations.

        Returns:
            Q-values of shape (B, num_actions).
        """
        h = self.conv(x)
        h = h.flatten(start_dim=1)
        feat = self.fc(h)

        if self.dueling:
            v = self.v_head(feat)  # (B, 1)
            a = self.a_head(feat)  # (B, num_actions)
            return v + a - a.mean(dim=-1, keepdim=True)
        else:
            return self.out_head(feat)
