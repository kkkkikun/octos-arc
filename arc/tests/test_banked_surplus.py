"""只动用**已经省下来**的预算，不向未来借钱。

keep @ D 的实测（2026-09-19）：全程只用掉预算的 63%，而丢掉的六个节点里有三个在开局附近，
那时 `remaining / nodes_left` 恰好是 1500，离它们需要的 1813 差 287 秒，修复停在第一轮。
把 `node_budget_cap` 从 1500 抬到 3000 救不了这三个——第 4 个节点的份额只有 1592，
上限根本没顶到。要救它们，只能让节点用上前面**已经省下**的时间。
"""
import unittest

import main


class _Flow:
    """只带 banked_surplus 需要的那两样：budget 和 remaining()。"""

    def __init__(self, budget, used):
        self.budget = budget
        self._used = used

    def remaining(self):
        return self.budget - self._used

    banked_surplus = main.Flow.banked_surplus


class BankedSurplusTests(unittest.TestCase):
    def test_ahead_of_schedule_releases_half_the_surplus(self):
        """keep 的第 4 个节点：32 题、48000s 预算，已跑 3 个用掉 1824s。
        按进度本该用掉 4500s，结余 2676s，放出一半 = 1338s。"""
        f = _Flow(48000, 1824)
        self.assertAlmostEqual(f.banked_surplus(4, 32), (48000 * 3 / 32 - 1824) / 2)
        share = f.remaining() / (32 - 4 + 1)
        self.assertLess(share, 1813, "光靠份额不够——这正是那三个节点输掉的原因")
        self.assertGreaterEqual(min(3000, share + f.banked_surplus(4, 32)), 1813,
                                "加上已省下的结余之后才够")

    def test_behind_schedule_changes_nothing(self):
        """超支时结余为 0，行为逐字不变——不能让一个已经超支的运行继续超支。"""
        f = _Flow(48000, 20000)          # 第 4 个节点就用掉 20000s，远超进度
        self.assertEqual(f.banked_surplus(4, 32), 0.0)

    def test_first_node_has_nothing_banked(self):
        """开局还没跑过任何节点，谈不上结余。"""
        f = _Flow(48000, 0)
        self.assertEqual(f.banked_surplus(1, 32), 0.0)

    def test_only_half_is_released(self):
        """留一半给后面，免得开局几个难节点把余额吃光、把尾巴饿到 240 秒地板。"""
        f = _Flow(1000, 0)
        self.assertAlmostEqual(f.banked_surplus(6, 10), (1000 * 5 / 10) / 2)

    def test_degenerate_inputs_are_safe(self):
        """预算或节点数缺失时返回 0，绝不让一个诊断性的加数把节点预算算炸。"""
        self.assertEqual(_Flow(0, 0).banked_surplus(4, 32), 0.0)
        self.assertEqual(_Flow(48000, 0).banked_surplus(4, 0), 0.0)

    def test_the_cap_and_floor_still_apply(self):
        """四个约束是叠加的：份额 + 结余，再被 cap 封顶、被 240 地板托住。"""
        f = _Flow(48000, 0)
        raw = f.remaining() / 1 + f.banked_surplus(32, 32)
        self.assertGreater(raw, 3000)
        self.assertEqual(min(3000, max(240, raw)), 3000, "cap 仍然封得住")
